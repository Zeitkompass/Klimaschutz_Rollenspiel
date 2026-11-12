import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { GameError } from "./lib/game/engine";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: false }));
app.use(cookieParser());
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof GameError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof Error && err.name === "ZodError") {
    res.status(400).json({ error: "Bitte prüfe deine Eingaben und versuche es noch einmal." });
    return;
  }
  req.log.error({ err }, "Spielanfrage fehlgeschlagen");
  res.status(500).json({ error: "Der Spielstand konnte gerade nicht geladen werden. Bitte versuche es gleich noch einmal." });
});

export default app;
