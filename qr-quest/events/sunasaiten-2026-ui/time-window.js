(function(){
  var path = (location.pathname || '');
  if (/\/time_closed\.html$/i.test(path)) return;

  function toJstParts(date){
    var j = new Date(date.getTime() + 9*60*60*1000);
    return {
      y: j.getUTCFullYear(),
      m: j.getUTCMonth()+1,
      d: j.getUTCDate(),
      hh: j.getUTCHours(),
      mm: j.getUTCMinutes()
    };
  }
  function num(parts){
    return parts.y*100000000 + parts.m*1000000 + parts.d*10000 + parts.hh*100 + parts.mm;
  }
  var now = num(toJstParts(new Date()));
  var testStart = 202604271200;
  var testEnd   = 202604271300;
  var mainStart = 202605030830;
  var mainEnd   = 202605051700;
  var allowed = (now >= testStart && now < testEnd) || (now >= mainStart && now < mainEnd);
  if (allowed) return;

  var mode = now < mainStart ? 'soon' : 'ended';
  location.replace('./time_closed.html?mode=' + mode);
})();
