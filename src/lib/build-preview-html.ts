import { ProjectFile } from '../types/project';

export function buildPreviewHtml(files: ProjectFile[]): string | null {
  // Check if it's a full Next.js/React app (needs WebContainer)
  const isFullApp = files.some(
    f => f.path === 'package.json' || f.path.startsWith('app/') || f.path.startsWith('src/app/') || f.path === 'next.config.js'
  );
  
  if (isFullApp) {
    return null; // Null means we should show the "WebContainer required" placeholder
  }

  // Look for index.html
  const htmlFile = files.find(f => f.path === 'index.html');
  if (!htmlFile) {
    return null;
  }

  let htmlContent = htmlFile.content;

  // Find CSS files
  const cssFiles = files.filter(f => f.path.endsWith('.css'));
  let cssInjections = '';
  for (const css of cssFiles) {
    cssInjections += `<style>\n${css.content}\n</style>\n`;
  }

  // Find JS files (excluding index.html itself of course)
  const jsFiles = files.filter(f => f.path.endsWith('.js'));
  let jsInjections = '';
  for (const js of jsFiles) {
    jsInjections += `<script>\n${js.content}\n</script>\n`;
  }

  // Inject CSS and JS into HTML
  if (htmlContent.includes('</head>')) {
    htmlContent = htmlContent.replace('</head>', `${cssInjections}</head>`);
  } else {
    htmlContent = `${cssInjections}${htmlContent}`;
  }

  if (htmlContent.includes('</body>')) {
    htmlContent = htmlContent.replace('</body>', `${jsInjections}</body>`);
  } else {
    htmlContent = `${htmlContent}${jsInjections}`;
  }

  // Inject Tailwind via CDN if not present? (Optional, maybe helpful for simple prototyping)
  if (!htmlContent.includes('tailwindcss')) {
     const tailwindCdn = `<script src="https://cdn.tailwindcss.com"></script>\n`;
     if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', `${tailwindCdn}</head>`);
     } else {
        htmlContent = `${tailwindCdn}${htmlContent}`;
     }
  }

  return htmlContent;
}
