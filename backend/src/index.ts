import env from "./config/env.config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import { runDailyCleanup } from "./workers/cleanup.worker";
import { startPingWorker } from "./workers/ping.worker";

const app = express();

app.set("trust proxy", 1);

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.get("/", (_, res) => res.send("Server is running..."));
app.use("/api", router);
app.use(errorMiddleware);

app.listen(env.PORT, () => {
  console.log(`Server is running on : http://localhost:${env.PORT}`);
  runDailyCleanup();
  startPingWorker();
});
