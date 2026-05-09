// apps/frontend/src/main.ts
// AngularJS アプリのエントリーポイント
// Vite が ES module として読み込む

import "angular";
import "./app/app.module";
import "./app/services/livekit.service";
import "./app/services/partykit.service";
import "./app/controllers/world.controller";
