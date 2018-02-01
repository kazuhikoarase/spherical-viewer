
window.onload = function() {

  'use strict';

  //var defaultSearch = 'sv_params=%7B"url"%3A"ueno_park.jpg"%2C"p"%3A6.262178969940567%2C"t"%3A0.21342468641979026%2C"z"%3A0.6704468055668809%7D';
  var defaultSearch = 'sv_params=%7B"url"%3A"nezu_jinja.jpg"%2C"p"%3A5.0111117091118995%2C"t"%3A0.2808143945548357%2C"z"%3A-0.5669114366236754%7D';

  var params = function(query_string) {
    var params = {};
    var kvList = query_string.split(/&/g);
    for (var i = 0; i < kvList.length; i += 1) {
      var kv = kvList[i].split(/=/);
      if (kv.length == 2) {
        params[kv[0]] = decodeURIComponent(kv[1]);
      }
    }
    return params;
  }(location.search? location.search.substring(1) : defaultSearch);

  var dbltap = function(handler) {
    var getTime = function() { return new Date().getTime(); };
    var lastTap = getTime();
    return function(event) {
      if (event.touches.length == 1) {
        var time = getTime();
        if (time - lastTap < 300) {
          handler(event);
        }
        lastTap = time;
      }
    };
  };

  var normalizeAngle = function(p) {
    var _2PI = Math.PI * 2;
    while (p < 0) { p += _2PI; }
    while (p >= _2PI) { p -= _2PI; }
    return p;
  };

  var sv_params = params.sv_params? JSON.parse(params.sv_params) : {};
  sv_params.url = sv_params.url || 'ueno_park.jpg';
  sv_params.p = sv_params.p || 0;
  sv_params.t = sv_params.t || 0;
  sv_params.z = sv_params.z || 0;

  var imageUrl = document.getElementById('imageUrl');
  imageUrl.value = sv_params.url;

  var ptz = {
    p : sv_params.p,
    t : sv_params.t,
    z : sv_params.z
  };
  ptz.p = normalizeAngle(ptz.p);

  var img_loadHandler = function() {
    var size = 2048;
    var w = size;
    var h = size >> 1;
    var cv = document.createElement('canvas');
    cv.setAttribute('width', '' + w);
    cv.setAttribute('height', '' + h);
    var ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    var viewer = spherical_viewer({ src : cv,
      width : viewerWidth, height : viewerHeight });
    viewer.setPTZ(ptz.p, ptz.t, ptz.z);
    viewer.canvas.addEventListener('dblclick', function() {
      viewer.toggleFullscreen();
    });
    viewer.canvas.addEventListener('touchstart', dbltap(function(event) {
      viewer.toggleFullscreen();
    } ) );
    document.getElementById('placeHolder').replaceChild(viewer.canvas, tmpCv);
    loading = false;

    var getUrl = document.getElementById('getUrl');
    getUrl.addEventListener('click', function(event) {
      if (imageUrl.value) {
        var ptz = viewer.getPTZ();
        ptz.p = normalizeAngle(ptz.p);
        location.href = '?sv_params=' + encodeURIComponent(JSON.stringify({
          url : imageUrl.value, p : ptz.p, t : ptz.t, z : ptz.z
        }) );
      }
    });
  };

  var viewerWidth = 640;
  var viewerHeight = 360;
  var loading = true;
  var lastTime = 0;
  var alphas = function() {
    var a = [];
    for (var i = 0; i < 18; i += 1) {
      a.push(0);
    }
    return a;
  }();
  var count = 0;

  var loadingAnimation = function(time) {
    if (lastTime == 0) {
      lastTime = time;
    } else if (time - lastTime > 100){
      alphas[count] = 1;
      count = (count + 1) % alphas.length;
      lastTime = time;
      tmpCtx.fillRect(0, 0, viewerWidth, viewerHeight);
      var r1 = 30;
      var r2 = 12;
      var cx = viewerWidth / 2;
      var cy = viewerHeight / 2;
      for (var i = 0; i < alphas.length; i += 1) {
        var t = 2 * Math.PI * i / alphas.length - Math.PI / 2;
        tmpCtx.beginPath();
        tmpCtx.moveTo(Math.cos(t) * r1 + cx, Math.sin(t) * r1 + cy);
        tmpCtx.lineTo(Math.cos(t) * r2 + cx, Math.sin(t) * r2 + cy);
        tmpCtx.closePath();
        tmpCtx.strokeStyle = 'rgba(255,255,255,' + alphas[i] + ')';
        tmpCtx.stroke();
        alphas[i] = Math.max(0, alphas[i] - 0.05);
      }
    }
    if (loading) {
      window.requestAnimationFrame(loadingAnimation);
    }
  };

  var tmpCv = document.createElement('canvas');
  tmpCv.setAttribute('width', '' + viewerWidth);
  tmpCv.setAttribute('height', '' + viewerHeight);
  var tmpCtx = tmpCv.getContext('2d');
  tmpCtx.fillStyle = '#666666';
  tmpCtx.fillRect(0, 0, viewerWidth, viewerHeight);
  tmpCtx.lineWidth = 4;
  tmpCtx.lineJoin = 'round';
  tmpCtx.lineCap = 'round';
  document.getElementById('placeHolder').appendChild(tmpCv);
  window.requestAnimationFrame(loadingAnimation);

  var img = new Image();
  img.addEventListener('load', img_loadHandler);
  img.crossOrigin = 'anonymous';
  img.src = sv_params.url;
};
