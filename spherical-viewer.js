//
// Spherical Viewer
//
// Copyright (c) 2017 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//

var spherical_viewer = function(opts) {

  'use strict';

  var debug = location.protocol == 'file:';

  var createShader = function(gl, type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    var res = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (res) {
      return shader;
    }
    var msg = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw 'createShader:' + msg;
  };

  var createProgram = function(gl, vertexShader, fragmentShader) {
    var pgm = gl.createProgram();
    gl.attachShader(pgm, vertexShader);
    gl.attachShader(pgm, fragmentShader);
    gl.linkProgram(pgm);
    var res = gl.getProgramParameter(pgm, gl.LINK_STATUS);
    if (res) {
      return pgm;
    }
    var msg = gl.getProgramInfoLog(pgm);
    gl.deleteProgram(pgm);
    throw 'createProgram:' + msg;
  };

  //---------------------------------------------------------------------

  var mat4 = function(m) {

    m = m || [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

    m.concat = function(n) {
      var o = [];
      for (var i = 0; i < 16; i += 1) {
        var v = 0;
        for (var j = 0; j < 4; j += 1) {
          v += m[~~(i / 4) * 4 + j] * n[i % 4 + j * 4];
        }
        o.push(v);
      }
      return mat4(o);
    };
    m.translateX = function(t) {
      return m.concat([ 1, 0, 0, t,
                         0, 1, 0, 0,
                         0, 0, 1, 0,
                         0, 0, 0, 1 ]);
    };
    m.translateY = function(t) {
      return m.concat([ 1, 0, 0, 0,
                         0, 1, 0, t,
                         0, 0, 1, 0,
                         0, 0, 0, 1 ]);
    };
    m.translateZ = function(t) {
      return m.concat([ 1, 0, 0, 0,
                         0, 1, 0, 0,
                         0, 0, 1, t,
                         0, 0, 0, 1 ]);
    };
    m.scaleX = function(s) {
      return m.concat([ s, 0, 0, 0,
                         0, 1, 0, 0,
                         0, 0, 1, 0,
                         0, 0, 0, 1 ]);
    };
    m.scaleY = function(s) {
      return m.concat([ 1, 0, 0, 0,
                         0, s, 0, 0,
                         0, 0, 1, 0,
                         0, 0, 0, 1 ]);
    };
    m.scaleZ = function(s) {
      return m.concat([ 1, 0, 0, 0,
                         0, 1, 0, 0,
                         0, 0, s, 0,
                         0, 0, 0, 1 ]);
    };
    m.rotateX = function(r) {
      var c = Math.cos(r);
      var s = Math.sin(r);
      return m.concat([ 1, 0, 0, 0,
                         0, c,-s, 0,
                         0, s, c, 0,
                         0, 0, 0, 1 ]);
    };
    m.rotateY = function(r) {
      var c = Math.cos(r);
      var s = Math.sin(r);
      return m.concat([ c, 0, s, 0,
                         0, 1, 0, 0,
                        -s, 0, c, 0,
                         0, 0, 0, 1 ]);
    };
    m.rotateZ = function(r) {
      var c = Math.cos(r);
      var s = Math.sin(r);
      return m.concat([ c,-s, 0, 0,
                         s, c, 0, 0,
                         0, 0, 1, 0,
                         0, 0, 0, 1 ]);
    };
    m.translate = function(t) {
      return m.translateX(t.x || 0).translateY(t.y || 0).translateZ(t.z || 0);
    };
    m.scale = function(s) {
      if (typeof s == 'number') {
        return m.scale({ x : s, y : s, z : s });
      }
      return m.scaleX(s.x || 1).scaleY(s.y || 1).scaleZ(s.z || 1);
    };
    m.invert = function() {
      return invert(m);
    };
    return m;
  };

  //---------------------------------------------------------------------

  var getSrc = function(id, src) {

    var dumpSrc = function(src) {
      var s = '';
      s = "getSrc('" + id + "',\n";
      var lineCount = 0;
      var lines = src.split(/[\r\n]+/g);
      for (var i = 0; i < lines.length; i += 1) {
        var line = lines[i];
        var index = line.indexOf('//');
        if (index != -1) {
          line = line.substring(0, index);
        }
        line = line.replace(/^\s+|\s+$/g, '').replace(/\s+/g, '\u0020');
        if (line.length == 0) {
          continue;
        }
        if (lineCount > 0) {
          s += ' +\n';
        }
        s += "  '" + line + "'";
        lineCount += 1;
      }
      s += ')';
      console.log(s);
    };

    if (debug) {
      var srcHolder = document.getElementById(id);
      if (!srcHolder) {
        return src;
      }
      src = srcHolder.text;
      dumpSrc(src);
      return src;
    } else {
      return src;
    }
  };

  var preparePgm = function() {
    var vs = createShader(gl, gl.VERTEX_SHADER,
        getSrc('vertex-shader1',
            'attribute vec3 aPosition;' +
            'uniform mat4 uMatrix;' +
            'attribute vec2 aTexcoord;' +
            'varying vec2 vTexcoord;' +
            'void main() {' +
            'gl_Position = vec4(aPosition, 1) * uMatrix;' +
            'vTexcoord = aTexcoord;' +
            '}') );
    var fs = createShader(gl, gl.FRAGMENT_SHADER,
        getSrc('fragment-shader1',
            'precision mediump float;' +
            'varying vec2 vTexcoord;' +
            'uniform sampler2D uTexture;' +
            'void main() {' +
            'gl_FragColor = texture2D(uTexture, vTexcoord);' +
            '}') );
    var pgm = createProgram(gl, vs, fs);
    gl.useProgram(pgm);
    return pgm;
  };

  var createDebugImage = function(size) {
    var unit = size >> 2;
    var cv = document.createElement('canvas');
    cv.setAttribute('width', '' + size);
    cv.setAttribute('height', '' + (size >> 1) );
    var ctx = cv.getContext('2d');
    ctx.strokeStyle = 'none';
    ctx.fillStyle = '#666666';
    ctx.fillRect(0, 0, size, size >> 1);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, unit, unit);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(unit, unit, unit, unit);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(unit * 2, 0, unit, unit);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(unit * 3, unit, unit, unit);
    ctx.fillStyle = '#ffffff';
    ctx.font = (size >> 4) + 'px sans-serif';
    ctx.fillText('Spherical Viewer', unit << 1, unit);
    return cv;
  };

  var prepareTexture = function() {

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0,
        gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([63, 63, 63]) );

    var loadImage = function(img) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
    };

    var maxTextureSize = +gl.getParameter(gl.MAX_TEXTURE_SIZE);
    var size = Math.min(opts.maxTextureSize || maxTextureSize,
        +gl.getParameter(gl.MAX_TEXTURE_SIZE) );

    if (debug) {
      loadImage(createDebugImage(size) );
    } else {
      var img_loadHandler = function() {
        var cv = document.createElement('canvas');
        cv.setAttribute('width', '' + size);
        cv.setAttribute('height', '' + (size >> 1) );
        var ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size >> 1);
        loadImage(cv);
        model.valid = false;
      };
      var img = new Image();
      img.addEventListener('load', img_loadHandler);
      img.crossOrigin = 'anonymous';
      img.src = opts.src;
    }
  };

  var prepareScene = function() {

    var vDiv = opts.vDiv || 32;
    var hDiv = opts.hDiv || vDiv << 1;
    var vt = [];
    var tx = [];
    var addPoint = function(h, v, vOffset) {
      var p = 2 * Math.PI * h / hDiv;
      var t = Math.PI * ( (v + vOffset) / vDiv - 0.5); 
      vt.push(Math.cos(p) * Math.cos(t) );
      vt.push(Math.sin(t) );
      vt.push(Math.sin(p) * Math.cos(t) );
      tx.push(p / (2 * Math.PI) + v);
      tx.push(1 - (t / Math.PI + 0.5) );
    };
    for (var v = 0; v < vDiv; v += 1) {
      for (var h = 0; h < hDiv; h += 1) {
        addPoint(h, v, v == 0? 0 : h / hDiv);
        addPoint(h, v, v == vDiv - 1? 1 : h / hDiv + 1);
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer() );
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tx), gl.STATIC_DRAW);

    var aTexcoordLoc = gl.getAttribLocation(pgm, 'aTexcoord');
    gl.enableVertexAttribArray(aTexcoordLoc);
    gl.vertexAttribPointer(aTexcoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer() );
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vt), gl.STATIC_DRAW);

    var aPositionLoc = gl.getAttribLocation(pgm, 'aPosition');
    gl.enableVertexAttribArray(aPositionLoc);
    gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);

    return vt.length / 3;
  };

  var updateScene = function() {

    model.r = model.width * Math.exp(Math.log(1.5) * model.z);
    var w = model.width;
    var h = model.height;

    var mat = mat4().translate({x : -1, y : -1, z : -1}).scale(2).
      scale({x : 1 / w, y : 1 / h, z : 1 / (model.r * 2)}).
      translate({x : w / 2, y : h / 2, z : model.r + 10}).
      rotateX(model.t).
      rotateY(model.p - Math.PI / 2).
      scale(model.r);

    gl.clearColor(0, 0, 0, 255);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var uMatrixLoc = gl.getUniformLocation(pgm, 'uMatrix');
    gl.uniformMatrix4fv(uMatrixLoc, false, mat);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, model.numPoints);
  };

  var prepareEvents = function() {
    var dragPoint = null;
    var target = window;
    cv.addEventListener('mousedown', function(event) {
      event.preventDefault();
      dragPoint = {
        p : model.p,
        t : model.t,
        z : model.z,
        x : event.pageX,
        y : event.pageY
      };
      model.dragging = true;
      model.zooming = event.ctrlKey;
      target.addEventListener('mousemove', doc_mousemoveHandler);
      target.addEventListener('mouseup', doc_mouseupHandler);
    });
    var doc_mousemoveHandler = function(event) {
      if (!model.zooming) {
        var p = dragPoint.p - (event.pageX - dragPoint.x) / model.r;
        var t = dragPoint.t - (event.pageY - dragPoint.y) / model.r;
        setPTZ(p, t, model.z);
      } else {
        var z = dragPoint.z - (event.pageY - dragPoint.y) / model.r;
        setPTZ(model.p, model.t, z);
      }
    };
    var doc_mouseupHandler = function(event) {
      model.dragging = false;
      target.removeEventListener('mousemove', doc_mousemoveHandler);
      target.removeEventListener('mouseup', doc_mouseupHandler);
    };
  };

  var setPTZ = function(p, t, z) {

    t = Math.max(-Math.PI / 2, Math.min(t, Math.PI / 2) );
    z = Math.max(-5, Math.min(z, 5) );

    model.p = p;
    model.t = t;
    model.z = z;
    model.valid = false;
  };

  var doMotion = function() {

    var attParam = function(id) {

      var vid = 'v' + id;
      var val = 0;

      var vBuf = [];
      var vBufIdx = 0;
      var vBufLen = 8;

      var getV = function() {
        var v = 0;
        for (var i = 0; i < vBuf.length; i += 1) {
          v += vBuf[i];
        }
        return v / vBuf.length;
      };
      var putV = function(v) {
        if (vBuf.length < vBufLen) {
          vBuf.push(v);
        } else {
          vBuf[vBufIdx] = v;
          vBufIdx = (vBufIdx + 1) % vBufLen;
        }
      };

      return {
        val : function() { return val; },
        delta : function(dt) {
          if (model.dragging) {
            putV( (model[id] - last[id]) / dt);
            model[vid] = getV();
          } else {
            val = model[id] + model[vid] * dt;
            model[vid] *= att;
            if (Math.abs(model[vid]) < limit) {
              model[vid] = 0;
            }
          }
        }
      };
      
    };

    var att = opts.att || 0.98;
    var limit = 1E-6;
    var last = null;

    var p = attParam('p');
    var t = attParam('t');
    var z = attParam('z');

    return function(dt) {
      if (last != null) {
        p.delta(dt);
        t.delta(dt);
        z.delta(dt);
        if (!model.dragging) {
          if (last.p != p.val() || last.t != t.val() || last.z != z.val() ) {
            setPTZ(p.val(), t.val(), z.val() );
          }
        }
      }
      last = { p : model.p, t : model.t, z : model.z };
    };
  }();

  var getFullscreenApiNames = function(target) {
    if (target.requestFullscreen) {
      return {
        requestFullscreen : 'requestFullscreen',
        exitFullscreen : 'exitFullscreen',
        fullscreenEnabled : 'fullscreenEnabled',
        fullscreenElement : 'fullscreenElement',
        fullscreenchange : 'fullscreenchange'
      };
    } else if (target.webkitRequestFullscreen) {
      return {
        requestFullscreen : 'webkitRequestFullscreen',
        exitFullscreen : 'webkitExitFullscreen',
        fullscreenEnabled : 'webkitFullscreenEnabled',
        fullscreenElement : 'webkitFullscreenElement',
        fullscreenchange : 'webkitfullscreenchange'
      };
    } else if (cv.mozRequestFullScreen) {
      return {
        requestFullscreen : 'mozRequestFullScreen',
        exitFullscreen : 'mozCancelFullScreen',
        fullscreenEnabled : 'mozFullScreenEnabled',
        fullscreenElement : 'mozFullScreenElement',
        fullscreenchange : 'mozfullscreenchange'
      };
    } else if (cv.msRequestFullscreen) {
      return {
        requestFullscreen : 'msRequestFullscreen',
        exitFullscreen : 'msExitFullscreen',
        fullscreenEnabled : 'msFullscreenEnabled',
        fullscreenElement : 'msFullscreenElement',
        fullscreenchange : 'msfullscreenchange'
      };
    } else {
      return null;
    }
  };

  var prepareFullscreen = function() {

    var names = getFullscreenApiNames(cv);
    if (!names || !document[names.fullscreenEnabled]) {
      return function() {};
    }

    var orgSize = null;
    var fullscreened = false;

    document.addEventListener(names.fullscreenchange, function(event) {

      if (!document[names.fullscreenElement]) {
        fullscreened = false;
        return;
      }

      if (!fullscreened) {
        // not current canvas.
        return;
      }

      cv.style.position = 'absolute';
      cv.style.left = '0px';
      cv.style.top = '0px';

      var lastSize = { width : 0, height : 0 };

      var watchWindow = function() {

        if (!document[names.fullscreenElement]) {
          // exit fullscreen.
          cv.style.position = '';
          cv.style.left = '';
          cv.style.top = '';
          cv.width = orgSize.width;
          cv.height = orgSize.height;
          return;
        }

        var size = { width : window.innerWidth, height : window.innerHeight };
        var resized = lastSize.width != size.width ||
          lastSize.height != size.height;
        if (resized) {
          cv.width = size.width;
          cv.height = size.height;
          lastSize = size;
        }
        window.setTimeout(watchWindow, 50);
      };
      watchWindow();
    });

    return function() {
      if (!document[names.fullscreenElement]) {
        fullscreened = true;
        orgSize = { width : cv.width, height : cv.height };
        cv[names.requestFullscreen]();
      } else {
        document[names.exitFullscreen]();
      }
    };
  };

  var update = function(now) {

    if (model.lastTime != 0) {
      doMotion(now - model.lastTime);
    }
    model.lastTime = now;

    var resized = model.width != gl.canvas.width ||
      model.height != gl.canvas.height;
    if (resized) {
      model.width = gl.canvas.width;
      model.height = gl.canvas.height;
      gl.viewport(0, 0, model.width, model.height);
      model.valid = false;
    }

    if (!model.valid) {
      updateScene();
      model.valid = true;
    }

    window.requestAnimationFrame(update);
  };

  //---------------------------------------------------------------------

  var cv = document.createElement('canvas');
  cv.setAttribute('width', '640');
  cv.setAttribute('height', '360');
  cv.style.cursor = 'all-scroll';

  var gl = cv.getContext('webgl') ||
    cv.getContext('experimental-webgl', { preserveDrawingBuffer: true });

  if (!gl) {
    console.log('gl not supported.');
    return null;
  }

  var model = {
    valid : false,
    lastTime : 0,
    width : 100,
    height : 100,
    numPoints : 0,
    r : 100,
    p : 0,
    t : 0,
    z : 0,
    vp : 0,
    vt : 0,
    vz : 0,
    dragging : false
  };

  var pgm = preparePgm();

  prepareTexture();

  model.numPoints = prepareScene();

  prepareEvents();

  gl.enable(gl.DEPTH_TEST);

  window.requestAnimationFrame(update);

  return {
    canvas : cv,
    setPTZ : setPTZ,
    getPTZ : function() {
      return { p : model.p, t : model.t, z : model.z };
    },
    toggleFullscreen : prepareFullscreen()
  };
};

!function(spherical_viewer) {
  if (typeof exports === 'object') {
    module.exports = spherical_viewer;
  }
}(spherical_viewer);
