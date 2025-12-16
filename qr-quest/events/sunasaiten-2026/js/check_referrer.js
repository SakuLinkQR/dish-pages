(function() {
    const allowedReferrers = [
        "scanner/qr-scanner.html"
    ];

    const currentReferrer = document.referrer;
    let isAllowed = false;

    // リファラーが許可されたものかどうかをチェック
    for (let i = 0; i < allowedReferrers.length; i++) {
        if (currentReferrer.includes(allowedReferrers[i])) {
            isAllowed = true;
            break;
        }
    }

    // 許可されていない場合はwarning.htmlにリダイレクト
    if (!isAllowed) {
        window.location.href = 'warning.html';
    }
})();
