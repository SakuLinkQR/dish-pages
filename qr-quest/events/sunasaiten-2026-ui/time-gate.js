(function(){
  try {
    var path = (location.pathname || '').replace(/\/g,'/');
    if (/\/time_closed\.html$/i.test(path)) return;

    function makeUtc(y,m,d,h,min){ return Date.UTC(y,m-1,d,h,min||0,0,0); }
    // JST windows converted to UTC (JST = UTC+9)
    var windows = [
      { start: makeUtc(2026,4,27,3,0), end: makeUtc(2026,4,27,4,0) },      // 2026-04-27 12:00-13:00 JST
      { start: makeUtc(2026,5,2,23,30), end: makeUtc(2026,5,5,8,0) }       // 2026-05-03 08:30 JST - 2026-05-05 17:00 JST
    ];

    var now = Date.now();
    var status = 'before';
    var allowed = false;
    for (var i=0;i<windows.length;i++) {
      if (now >= windows[i].start && now < windows[i].end) {
        allowed = true;
        break;
      }
    }
    if (!allowed) {
      if (now >= windows[windows.length-1].end) status = 'after';
      var target = './time_closed.html?status=' + encodeURIComponent(status);
      if (location.search) target += '&from=' + encodeURIComponent(path + location.search);
      else target += '&from=' + encodeURIComponent(path);
      location.replace(target);
    }
  } catch (e) {}
})();
