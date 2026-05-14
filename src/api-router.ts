import express from "express";
import { createClient } from "@supabase/supabase-js";
import { Octokit } from "@octokit/rest";

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

router.post("/ai/chat", async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is missing." });
    }

    const { messages, model, mode, temperature, systemPrompt: customSystemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages array." });
    }

    let systemPrompt = "Anda ialah AI software engineer expert. Anda bantu user bina aplikasi full-stack menggunakan Next.js, TypeScript, Tailwind CSS, Supabase dan PostgreSQL. Bila user minta bina app, hasilkan struktur file lengkap dalam JSON yang boleh terus dimasukkan ke file editor. Utamakan code lengkap, selamat, production-ready dan mudah deploy. Jawab dalam Bahasa Melayu kecuali bahagian code.";
    
    if (customSystemPrompt) {
      systemPrompt = customSystemPrompt;
    }

    if (mode === 'Build Full App' || mode === 'Generate Code') {
      systemPrompt += `\n\nPENTING: Untuk mode ini, anda MESTI memulangkan response dalam format JSON yang sah SAHAJA. Jangan masukkan sebarang teks sebelum atau selepas JSON blok. Format JSON mesti mengikut spesifikasi berikut:
{
  "explanation": "Ringkasan app atau perubahan",
  "files": [
    {
      "path": "app/page.tsx",
      "language": "tsx",
      "content": "kod penuh di sini. kod mesti lengkap, buang elipsis atau tempat kosong."
    }
  ],
  "commands": [
    "npm install foo bar"
  ],
  "notes": [
    "Nota tambahan"
  ]
}`;
    }

    const deepseekMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const apiModel = model === 'deepseek-v4-pro' ? 'deepseek-reasoner' : 'deepseek-chat';
    const finalTemperature = temperature !== undefined ? temperature : (mode === 'Build Full App' || mode === 'Generate Code' ? 0.2 : 0.7);

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: apiModel,
        messages: deepseekMessages,
        temperature: finalTemperature,
        response_format: (mode === 'Build Full App' || mode === 'Generate Code') && apiModel === 'deepseek-chat' 
          ? { type: 'json_object' } 
          : undefined
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("DeepSeek API Error:", errorData);
      let errorMsg = "Gagal menyambung ke DeepSeek API.";
      try {
         const parsedStatus = JSON.parse(errorData);
         if (parsedStatus.error && parsedStatus.error.message) {
             errorMsg = `DeepSeek API Error: ${parsedStatus.error.message}`;
         }
      } catch(e) {
         errorMsg = `DeepSeek API Error (Status ${response.status}): ${errorData}`;
      }
      return res.status(response.status).json({ error: errorMsg });
    }

    const data = await response.json();
    res.json({
       ...data.choices[0].message,
       usage: data.usage
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- GitHub Integrations ---
router.get("/github/connect", (req, res) => {
  const userId = req.query.user_id as string;
  if (!userId) return res.status(400).send("user_id required");
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  const state = Buffer.from(userId).toString('base64');
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo&state=${state}`;
  res.redirect(url);
});

router.get("/github/callback", async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  
  if (!code || !state) return res.status(400).send("Invalid callback");
  const userId = Buffer.from(state, 'base64').toString('ascii');

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI
      })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description);

    const accessToken = tokenData.access_token;
    
    const userRes = await fetch("https://api.github.com/user", {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();
    
    await supabaseAdmin.from('github_connections').upsert({
      user_id: userId,
      github_username: userData.login,
      access_token_encrypted: accessToken, 
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    res.redirect("/?github_connected=true");
  } catch (e: any) {
    console.error(e);
    res.status(500).send("Error connecting to GitHub: " + e.message);
  }
});

const getGitHubToken = async (userId: string) => {
  const { data } = await supabaseAdmin.from('github_connections').select('access_token_encrypted').eq('user_id', userId).single();
  return data?.access_token_encrypted;
};

router.get("/github/repos", async (req, res) => {
  const userId = req.query.user_id as string;
  if (!userId) return res.status(400).json({ error: "user_id required" });

  const token = await getGitHubToken(userId);
  if (!token) return res.status(401).json({ error: "Not connected to GitHub" });
  
  try {
    const reposRes = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const repos = await reposRes.json();
    if (!reposRes.ok) return res.status(reposRes.status).json({ error: repos.message });
    res.json(repos);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/github/create-repo", async (req, res) => {
  const { user_id, name, description, isPrivate } = req.body;
  const token = await getGitHubToken(user_id);
  if (!token) return res.status(401).json({ error: "Not connected to GitHub" });
  
  try {
    const createRes = await fetch("https://api.github.com/user/repos", {
       method: "POST",
       headers: { 
         "Authorization": `Bearer ${token}`,
         "Content-Type": "application/json"
       },
       body: JSON.stringify({
         name,
         description: description || 'Created from DeepSeek AI App Builder',
         private: isPrivate,
         auto_init: true
       })
    });
    const repo = await createRes.json();
    if (!createRes.ok) return res.status(createRes.status).json(repo);
    res.json(repo);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/github/push", async (req, res) => {
  const { user_id, repoOwner, repoName, files, commitMessage } = req.body;
  const token = await getGitHubToken(user_id);
  if (!token) return res.status(401).json({ error: "Not connected to GitHub" });
  
  try {
    const octokit = new Octokit({ auth: token });
    
    const { data: repo } = await octokit.repos.get({
      owner: repoOwner,
      repo: repoName
    });
    const branchName = repo.default_branch || 'main';

    const { data: ref } = await octokit.git.getRef({
      owner: repoOwner,
      repo: repoName,
      ref: `heads/${branchName}`
    });
    const latestCommitSha = ref.object.sha;

    const { data: commit } = await octokit.git.getCommit({
      owner: repoOwner,
      repo: repoName,
      commit_sha: latestCommitSha
    });
    const baseTreeSha = commit.tree.sha;

    const treeItems = await Promise.all(files.map(async (file: any) => {
      const { data: blob } = await octokit.git.createBlob({
        owner: repoOwner,
        repo: repoName,
        content: file.content,
        encoding: 'utf-8'
      });
      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha
      };
    }));

    const { data: newTree } = await octokit.git.createTree({
      owner: repoOwner,
      repo: repoName,
      base_tree: baseTreeSha,
      tree: treeItems
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner: repoOwner,
      repo: repoName,
      message: commitMessage || "Update from DeepSeek AI App Builder",
      tree: newTree.sha,
      parents: [latestCommitSha]
    });

    await octokit.git.updateRef({
      owner: repoOwner,
      repo: repoName,
      ref: `heads/${branchName}`,
      sha: newCommit.sha
    });

    res.json({ success: true, commitUrl: newCommit.html_url });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || "Failed to push" });
  }
});

export default router;
