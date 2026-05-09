// apps/frontend/src/app/app.module.ts
import angular from "angular";

// 環境変数 (Vite が .env.local から注入)
export const ENV = {
  LIVEKIT_URL:   import.meta.env.VITE_LIVEKIT_URL   ?? "ws://localhost:7880",
  API_BASE_URL:  import.meta.env.VITE_API_BASE_URL   ?? "http://localhost:8787",
  PARTYKIT_HOST: import.meta.env.VITE_PARTYKIT_HOST  ?? "localhost:1999",
} as const;

angular.module("gatherApp", []);
