// Must be the first import: it loads .env before the modules below read process.env
import "dotenv/config";
import express from "express";
import cors from "cors";
import queryRouter from "./routes/query";
import documentsRouter from "./routes/documents";
import { PYTHON_BIN, PYTHON_DIR } from "./pythonConfig";
import { startWorker } from "./pythonWorker";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(",") ?? "*";

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "sentinel-rag-backend" });
});

app.use("/api", queryRouter);
app.use("/api", documentsRouter);

app.listen(PORT, () => {
  console.log(`Sentinel RAG backend listening on http://localhost:${PORT}`);
  console.log(`Python: ${PYTHON_BIN}`);
  console.log(`Python folder: ${PYTHON_DIR}`);
  startWorker(); // loads the models in the background so the first question is fast
});
