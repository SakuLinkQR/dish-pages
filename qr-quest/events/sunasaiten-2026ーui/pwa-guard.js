// pwa-guard.js
(function(){
  function isStandalone(){
    try{
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    }catch(e){
      return false;
    }
  }

  function requiredUrl(){
    // どの階層からでも正しい場所へ
    if(location.pathname.indexOf('/scanner/') !== -1) return '../start_required.html';
    return './start_required.html';
  }

  try{
    var ok = !!localStorage.getItem('setup_done') && !!localStorage.getItem('start_area') && isStandalone();
    if(!ok){
      if(!/start_required\.html/i.test(location.pathname)){
        location.replace(requiredUrl());
      }
    }
  }catch(e){}
})();
