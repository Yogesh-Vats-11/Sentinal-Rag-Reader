import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import queryRouter from "./routes/query";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(",") ?? "*";

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "sentinel-rag-backend" });
});

app.use("/api", queryRouter);

app.listen(PORT, () => {
  console.log(`Sentinel RAG backend listening on http://localhost:${PORT}`);
});
