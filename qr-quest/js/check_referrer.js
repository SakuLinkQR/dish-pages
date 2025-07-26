const allowedReferers = [
  "https://sakulink.com/qr-quest/qr-scanner.html",  // 正規スキャナーのURL
];

if (!allowedReferers.some(ref => document.referrer.startsWith(ref))) {
  // スキャナー以外からのアクセス
  window.location.href = "warning.html";
}
