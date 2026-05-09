export const environment = {
  production: true,
  apiBaseUrl: 'https://api.kayaba-broadway.workers.dev',
  partykitHost: 'kayaba-broadway.yasunariiguchi.partykit.dev',
  stripePublicKey:
    'pk_test_51TR8Yd1lp8GZIfDzFSJrRBkJZJMpPDP1n333ba4BYUdcJ61e3IszQbtEbSv5bqwX1RH4g2KXUS0NjnBmfydwWAkF00SyIUjiMA',
  livekitApiKey: 'devkey',
  livekitApiSecret: 'secret-at-least-32-chars-long!!',
  //# ローカル:  ws://localhost:7880
  //# 本番:     wss://your-app.livekit.cloud  or  wss://your.oracle.host:7880
  livekitUrl: 'ws://localhost:7880',
};
