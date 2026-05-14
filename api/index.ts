import express from "express";
import apiRouter from "../src/api-router";

const app = express();
app.use(express.json());
app.use("/api", apiRouter);

export default app;
