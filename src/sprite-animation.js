/**
 * Sprite animation class (plays texture packer a atlas)
 *
 * - Uses a SpriteCache class to store the loaded textures.
 * - Requires a JSON hash format.
 * - Multipacking is supported
 * - Trim is supported
 * - Rotation is NOT supported (yet)
 *
 *
 * @namespace
 * @name sprite-animation.js
 * @author Rick Ekelschot | Code d'Azur
 * @date: 22/04/14
 */

/*jslint browser: true, nomen: true, devel: true */
/*global requirejs, define, window, document, $, _  */


(function (root, factory) {

    if (typeof define === 'function' && define.amd) {
        define(['jquery'], function (b) {
            return (root.amdWebGlobal = factory(b));
        });
    } else {
        root.amdWebGlobal = factory(root.b);
    }

} (this, function ($) {

    'use strict';

    /**
     * Sprite Animation constructor.
     *
     * @param target {element} The DOM element which serves as the canvas container
     * @param autoAppend {boolean} Default: true, Automatically append to the target
     * @param ignoreAtlasScale {boolean} Default: true, Ignore the atlas scale meta
     * @returns {{load: Function, addAnimation: Function, play: Function, setOffset: Function, stop: Function, dispose: Function, setAnimation: Function, frame: Function, on: Function, one: Function, off: Function, cache: Function, canvasSupported: Function, isRetina: Function}}
     * @constructor
     */
    var SpriteAnimation = function(target, autoAppend, ignoreAtlasScale) {

        var _target = target,
            _eventDispatcher = $('<div></div>'),
            _autoAppend = (autoAppend !== undefined && autoAppend !== null) ? autoAppend : true,
            _appended = false,
            _ignoreAtlasScale = (ignoreAtlasScale !== undefined && ignoreAtlasScale !== null) ? ignoreAtlasScale : true,
            _canvas,
            _context,
            _canvasSupport = true,
            _loaded = false,
            _ready = false,
            _hasLoadListener = false,
            _animations = [],
            _currentAnimation,
            _currentFrame,
            _interval,
            _offset,
            _startOpacity,
            _playing,
            _stopped,
            _ms,
            _spriteCache = SpriteCache.getInstance(),

            setupAnimation,
            setupAnimations,
            getFrameName,
            getFrameAtlasIndex,
            onReady,
            createCanvas,
            appendCanvas,
            removeCanvas,
            setCanvasOffset,
            canvasSupported,
            getMaxSize,
            playAnimation,
            setFrame,
            dispatchEvent,
            removeInterval,
            getFrameNumber,
            clearCanvas,
            setupLoadedListener,
            isRetina,
            stop;


        /**
         * Setup the registered animations one by one.
         */

        setupAnimations = function () {
            var item;

            for (item in _animations) {
                if (!_animations[item].setup) {
                    setupAnimation(item, _animations[item].frameName, _animations[item].delimiter, _animations[item].startIndex, _animations[item].fps);
                }
            }

            onReady();
        }


        /**
         * Called by the setupAnimations() loop
         *
         * @param name {string} Name of the animation
         * @param frameName {string} Frame name of the animation. For example animation_%%.png
         * @param delimiter {string} Delimiter, corresponds to the delimiter used in the frameName, for example %
         * @param startIndex {int} The number at which the frameNames start
         * @param fps {int} The frames per second at which this animation should run
         */

        setupAnimation = function (name, frameName, delimiter, startIndex, fps) {
            var animation = {
                frameName: frameName,
                delimiter: delimiter,
                setup: false,
                startIndex: startIndex,
                fps: fps
            };
            if (_animations[name]) {

                if (_animations[name].shouldPlay) {
                    animation.shouldPlay = true;
                }

                if (_animations[name].loop) {
                    animation.loop = _animations[name].loop;
                }
            }

            if (_loaded) {
                var frames = [],
                    frameCount = startIndex,
                    index,
                    frame,
                    frameData,
                    max = 100000,
                    atlas = _spriteCache.atlases();

                while ((frame = getFrameName(frameName, delimiter, frameCount), index = getFrameAtlasIndex(frame)) && index !== -1 && frameCount < max) {
                    frameData = atlas[index].frames[frame];
                    frameData.name = frame;
                    frameData.image = atlas[index].meta.image;
                    frameData.scale = atlas[index].meta.scale;
                    frames.push(frameData);
                    frameCount += 1;
                }

                animation.fps = fps;
                animation.from = 0;
                animation.to = frames.length - 1;
                animation.frames = frames;
                if (animation.loop === undefined) {
                    animation.loop = false;
                }
                _animations[name] = animation;

            } else {
                _animations[name] = animation;
                setupLoadedListener();
            }

        }

        /**
         * Get the altas index of a frameName
         *
         * @param frameName {string}
         * @returns {number} Index of the atlas file
         */

        getFrameAtlasIndex = function (frameName) {
            var index = -1,
                altas;

            for (altas in _spriteCache.atlases()) {
                if (_spriteCache.atlases()[altas].frames[frameName]) {
                    index = altas;
                    break;
                }
            }

            return index;
        }


        /**
         * Convert the delimiter in the frameName to a actual frame in the atlas
         *
         * @param frameName {string} Frame name of the animation. For example animation_%%.png
         * @param delimiter {String} Delimiter, corresponds to the delimiter used in the frameName, for example %
         * @param frame {int} The frame index
         * @returns {string} The actual frame in the atlas
         */

        getFrameName = function (frameName, delimiter, frame) {
            var minLength = frameName.split(delimiter).length - 1,
                correctFrame = frame.toString(),
                correctFrameName;

            while (correctFrame.length < minLength) {
                correctFrame = "0" + correctFrame;
            }


            correctFrameName = frameName.substr(0, frameName.indexOf(delimiter)) + correctFrame + frameName.substr(frameName.lastIndexOf(delimiter) + 1, frameName.length)
            return correctFrameName;
        }


        /**
         * Convert a frameName to a frameNumber
         *
         * @param animation {string}
         * @param frameName
         * @returns {number}
         */

        getFrameNumber = function (animation, frameName) {
            var i,
                l;

            for (i = 0, l = _animations[animation].frames.length; i < l; i += 1) {
                if (_animations[animation].frames[i].name === frameName) {
                    return i;
                }
            }

            return -1;
        }

        /**
         * Get the maxSize the canvas can be, loops through all the animation.
         *
         * @returns {{w: number, h: number}}
         */

        getMaxSize = function () {
            var maxSize = {
                    w: 0,
                    h: 0
                },
                animation,
                index,
                frame,
                scale;

            for (animation in _animations) {
                for (index in _animations[animation].frames) {
                    frame = _animations[animation].frames[index];
                    if (frame.sourceSize.w > maxSize.w && frame.sourceSize.h > maxSize.h) {
                        scale = _ignoreAtlasScale ? 1 : frame.scale;

                        maxSize.w = frame.sourceSize.w / scale;
                        maxSize.h = frame.sourceSize.h / scale;
                    }
                }
            }

            return maxSize;
        }


        /**
         * Clear the interval
         */

        removeInterval = function () {
            if (_interval) {
                window.clearInterval(_interval);
                _interval = null;
            }
        }


        /**
         * Called when everything is ready for animation
         */

        onReady = function () {
            var animation;

            _ready = true;
            dispatchEvent('sprite-animation:ready');

            for(animation in _animations) {
                if (_animations[animation].shouldPlay) {
                    playAnimation(animation, _animations[animation]);
                    break;
                }
            }
        }


        /**
         * Create a new instance of a canvas
         */

        createCanvas = function () {
            var dimensions = getMaxSize();

            _canvas = $('<canvas width="' + dimensions.w + '" height="' + dimensions.h + '"></canvas>')[0];

            if (isRetina()) {
                $(_canvas).css({
                    '-moz-transform': 'scale(0.5, 0.5)',
                    '-ms-transform': 'scale(0.5, 0.5)',
                    '-webkit-transform': 'scale(0.5, 0.5)',
                    'transform': 'scale(0.5, 0.5)',
                    '-moz-transform-origin': '0% 0%',
                    '-ms-transform-origin': '0% 0%',
                    '-webkit-transform-origin': '0% 0%',
                    'transform-origin': '0% 0%'
                });
            }

            if (_target && _autoAppend) {
                appendCanvas();
            }

            _context = _canvas.getContext('2d');
        }


        /**
         * Append the canvas instance to the target container. Empties the container in the process
         */

        appendCanvas = function () {
            _appended = true;

            $(_target).empty();
            $(_target).append(_canvas);

            if (_offset) {
                setCanvasOffset();
            }
        }


        /**
         * Removes the canvas
         */
        removeCanvas = function () {
            if (_appended) {
                $(_canvas).remove();
                _canvas = null;
                _context = null;
            }
        }


        /**
         * Apply a offset to the canvas. The offset is relative
         */

        setCanvasOffset = function () {
            $(_canvas).css({
                position: 'relative',
                top: _offset.y + 'px',
                left: _offset.x + 'px'
            });
        }


        /**
         * Is canvas supported
         *
         * @returns {boolean} Is canvas supported
         */

        canvasSupported = function () {
            if (document.createElement('canvas').getContext === undefined) {
                return false;
            } else if (navigator.userAgent.match(/(Android (1.0|1.1|1.5|1.6|2.0|2.1))|(GT-P5110)|(Windows Phone (OS 7))|(XBLWP)|(ZuneWP)|(w(eb)?OSBrowser)|(webOS)|(Kindle\/(1.0|2.0|2.5|3.0))/)) {
                return false;
            }

            return true;
        }


        /**
         * Play a animation by name
         *
         * @param animation {string} The name of the animation
         * @param options {{from: {number}, to: {number}, loop: {number}}
         */

        playAnimation = function (animation, options) {
            options = options ? options : {};

            if (_animations[animation]) {
                if (_ready) {
                    _animations[animation].from = options.from !== undefined ? options.from : 0;
                    _animations[animation].to = options.to !== undefined ? options.to : _animations[animation].frames.length - 1;
                    _animations[animation].loop = options.loop ? options.loop : false;

                    _currentFrame = _animations[animation].from;
                    _currentAnimation = animation;

                    _playing = true;
                    _stopped = false;
                    _ms = (1000 / _animations[animation].fps);

                    setFrame();

                } else {

                    _animations[animation].shouldPlay = true;
                    _animations[animation].from = options.from !== undefined ? options.from : undefined;
                    _animations[animation].to = options.to !== undefined ? options.to : undefined;
                    _animations[animation].loop = options.loop !== undefined ? options.loop : undefined;
                }
            }
        }


        /**
         * Set the current frame to the canvas
         */

        setFrame = function () {
            if (!_stopped) {
                if (_currentFrame < _animations[_currentAnimation].frames.length && _currentFrame <= _animations[_currentAnimation].to) {
                    var frameData = _animations[_currentAnimation].frames[_currentFrame],
                        frame = frameData.frame,
                        image = _spriteCache.images()[frameData.image],
                        scale = _ignoreAtlasScale ? 1 : frameData.scale;

                    if (!_canvas) {
                        createCanvas();
                    }

                    clearCanvas();
                    try {
                        _context.drawImage(image, frame.x, frame.y, frame.w, frame.h, frameData.spriteSourceSize.x / scale, frameData.spriteSourceSize.y / scale, frame.w / scale, frame.h / scale);

                        if (_playing) {
                            window.setTimeout(function () {
                                _currentFrame += 1;
                                setFrame();
                            }, _ms);
                        }
                    } catch (error) {
                        throw new Error('Error drawing to context', error);
                    }
                } else if (_animations[_currentAnimation].loop) {
                    dispatchEvent('sprite-animation:animation-loop', _currentAnimation);
                    _currentFrame = _animations[_currentAnimation].from;
                    setFrame();
                } else {
                    _playing = false;
                    dispatchEvent('sprite-animation:animation-done', _currentAnimation);
                }
            }

        }


        /**
         * Clear the canvas
         */

        clearCanvas = function () {
            if (_context) {
                _context.clearRect(0, 0, _canvas.width, _canvas.height);
            }
        }


        /**
         * Stop all animations
         *
         * @param clear {boolean} Clear canvas in the process
         */

        stop = function (clear) {
            var index;

            _stopped = true;

            if (clear) {
                clearCanvas();
            }

            for (index in _animations) {
                _animations[index].shouldPlay = false;
            }
        }


        /**
         * Dispatch a event
         * @param event {string}
         */

        dispatchEvent = function (event, args) {
            _eventDispatcher.trigger(event, args);
        }


        /**
         * Set the loaded listener
         */

        setupLoadedListener = function () {
            if (!_hasLoadListener) {
                _hasLoadListener = true;
                _spriteCache.one("sprite-cache:loaded", function () {
                    _hasLoadListener = false;
                    _loaded = true;
                    setupAnimations();
                });
            }
        }


        /**
         * Detect if is retina display
         */

        isRetina = function () {
            //We need to make a exception specially for Microsoft...
            if (navigator.userAgent.match(/(Windows Phone)/)) {
                return (window.devicePixelRatio === undefined && Math.round(window.screen.availWidth / document.documentElement.clientWidth) > 1);
            }

            return (window.devicePixelRatio !== undefined && window.devicePixelRatio > 1);
        }



        /*
         * Public functions
         */

        return {

            /**
             * Load a Atlas or multiple atlasses
             *
             * @param urls {string|array} A single or multiple JSON atlas files
             * @param retinaUrls {string|array} A single or multiple JSON retina atlas files
             */
            load: function (urls, retinaUrls) {
                if (!canvasSupported()) {
                    _canvasSupport = false;
                    $(_target).addClass('no-canvas');
                    return;
                }

                _loaded = false;
                setupLoadedListener();

                this.cache().load(urls, retinaUrls, isRetina());
            },


            /**
             * Add a animation to this SpriteAnimation instance
             *
             * @param name {string} The name of the animation
             * @param frameName {string} Frame name of the animation. For example animation_%%.png
             * @param delimiter {string} Delimiter, corresponds to the delimiter used in the frameName, for example %
             * @param startIndex {int} The number at which the frameNames start
             * @param fps {int} The frames per second at which this animation should run
             */
            addAnimation: function (name, frameName, delimiter, startIndex, fps) {
                if (_canvasSupport) {
                    setupAnimation(name, frameName, delimiter, startIndex, fps);
                }
            },


            /**
             * Play a animation by name
             *
             * @param animation {string} The name of the animation
             * @param loop {boolean} Loops the animation
             * @param from {int} The start frame
             * @param to {int} The end frame
             * @param options {{startOpacity: {number}}} A optional configuration object
             */
            play: function (animation, loop, from, to, options) {
                if (_canvasSupport) {
                    options = options !== undefined ? options : {};

                    if (typeof from === 'string') {
                        from = getFrameNumber(animation, from);
                        if (from === -1) {
                            from = undefined;
                        }
                    }

                    if (typeof to === 'string') {
                        to = getFrameNumber(animation, to);
                        if (to === -1) {
                            to = undefined;
                        }
                    }


                    options.loop = loop;
                    options.from = from;
                    options.to = to;
                    playAnimation(animation, options);
                }
            },


            /**
             * Apply a offset to the canvas. The offset is relative
             *
             * @param x {number} X offset
             * @param y {number} Y offset
             */
            setOffset: function (x, y) {
                if (_canvasSupport) {
                    _offset = {
                        x: x,
                        y: y
                    };

                    if (_canvas && _appended) {
                        setCanvasOffset();
                    }
                }
            },


            /**
             * Stops the current animation
             */
            stop: function (clear) {
                if (_canvasSupport) {
                    stop();
                }
            },


            /**
             * Disposes the SpriteAnimation instance
             */
            dispose: function () {
                if (!_stopped) {
                    this.stop();
                }

                clearCanvas();
                removeCanvas();
            },


            /**
             * Sets the current animation
             *
             * @param animation {string} Animation name
             */
            setAnimation: function (animation) {
                if (_canvasSupport) {
                    _currentAnimation = animation;
                }
            },


            /**
             * Set's the current frame of the animation. Can be used as a TweenMax variable
             * @param frameNumber {number} The frame number
             * @returns {number} Initially returns 0 for compatibility with TweenMax
             */
            frame: function (frameNumber) {
                if (_canvasSupport) {
                    if (!isNaN(frameNumber)) {
                        _currentFrame = Math.round(frameNumber);
                        setFrame();
                    } else {
                        return 0;
                    }
                }
            },


            /**
             * Add a listener to the SpriteAnimation instance
             *
             * @param event {string} The event name
             * @param listener {function} The callback function
             * @param scope {object} The callback function's scope
             */
            on: function (event, listener, scope) {
                _eventDispatcher.on(event, listener, scope);
            },


            /**
             * Add a listener to the SpriteAnimation instance ONCE
             *
             * @param event {string} The event name
             * @param listener {function} The callback function
             * @param scope {object} The callback function's scope
             */
            one: function (event, listener, scope) {
                _eventDispatcher.one(event, listener, scope);
            },


            /**
             * Remove a listener of the SpriteAnimation instance
             *
             * @param event {string} The event name
             * @param listener {function} The callback function
             * @param scope {object} The callback function's scope
             */
            off: function (event, listener, scope) {
                _eventDispatcher.off(event, listener, scope);
            },


            /**
             * Get a instance of the SpriteAnimation Cache. The Cache is shared throughout the different instances
             *
             * @returns {object} SpriteCache instance
             */
            cache: function () {
                return SpriteCache.getInstance();
            },



            /**
             * Is canvas supported by the device
             *
             * @returns {boolean} Canvas supported
             */
            canvasSupported: function () {
                return canvasSupported();
            },


            /**
             * Does the device have a retina display
             *
             * @returns {boolean} Retina display
             */
            isRetina: function () {
                return isRetina();
            }

        }
    }

    var SpriteCache = function () {

        "use strict";

        if (SpriteCache._instance) {
            return SpriteCache._instance;
        }


        var _eventDispatcher = $('<div></div>'),
            _isLoading = false,
            _loaded = false,
            _urls,
            _url,
            _atlases = [],
            _image,
            _imageName,
            _images = [],

            loadAtlas,
            onLoadAtlasSuccess,
            onLoadAtlasImageSuccess,
            loadAtlasImage,
            addData,
            getData,
            onLoaded,
            dispatchEvent;





        /**
         * Private function for loading a atlas (json) file
         */

        loadAtlas = function () {

            if (_urls.length > 0) {
                _url = _urls.pop();
                _isLoading = true;

                if (getData(_url) || getData(_url) === 'loading') {
                    loadAtlas();
                } else {
                    addData(_url, 'loading');
                    $.ajax({
                        dataType: "json",
                        url: _url,
                        success: onLoadAtlasSuccess
                    });
                }
            } else {
                onLoaded();
            }
        }


        /**
         * When Atlas is loaded store the atlas in our Cache and start loading the image
         *
         * @param data {JSON} The atlas
         * @param status {object}
         * @param response {object}
         * @param skipCache {boolean} Skips the save to cache step if true
         */

        onLoadAtlasSuccess = function (data, status, response) {
            _imageName = data.meta.image;

            addData(_url, data);

            if (!getData(_imageName)) {
                loadAtlasImage(_url.substr(0, _url.lastIndexOf('/')) + '/' + _imageName);
            } else {
                loadAtlas();
            }
        }


        /**
         * Load the current atlas image. Uses a new Image()
         */

        loadAtlasImage = function (url) {
            var self = this;


            _image = new Image();
            $(_image).on('load', function () {
                onLoadAtlasImageSuccess();
            });

            _image.src = url;
        }


        /**
         * Called when the image is loaded and stores the image in the cache.
         *
         * @param event {object}
         * @param skipCache {boolean}
         */

        onLoadAtlasImageSuccess = function (event) {
            addData(_imageName, _image);
            loadAtlas();
        }


        /**
         * Add data to the SpriteCache
         *
         * @param url {string} URL of the data
         * @param data {json|Image} Data
         */
        addData = function (url, data) {
            if (data instanceof Image) {
                _images[url] = data;
            } else {
                _atlases[url] = data;
            }
        }


        /**
         * Get data from the SpriteCache
         *
         * @param url
         */

        getData = function (url) {
            if (_atlases[url]) {
                return _atlases[url];
            } else if (_images[url]) {
                return _images[url];
            }

            return null;
        }


        /**
         * Called when done loading
         */
        onLoaded = function () {
            _loaded = true;
            _isLoading = false;
            dispatchEvent('sprite-cache:loaded');
        }


        /**
         * Dispatch a event
         * @param event {string}
         */

        dispatchEvent = function (event) {
            _eventDispatcher.trigger(event);
        }


        SpriteCache._instance = {

            /**
             * Load a Atlas or multiple atlasses
             *
             * @param urls {string|array} A single or multiple JSON atlas files
             * @param retinaUrls {string|array} A single or multiple JSON retina atlas files
             */
            load: function (urls, retinaUrls, isRetina) {
                var loadUrls;

                if (typeof urls === "string") {
                    urls = [urls];
                }

                if (typeof retinaUrls === "string") {
                    retinaUrls = [retinaUrls];
                }

                if (isRetina && retinaUrls) {
                    loadUrls = retinaUrls;
                } else {
                    loadUrls = urls;
                }


                _urls = _urls ? _urls.concat(loadUrls) : loadUrls;

                if (!_isLoading) {
                    loadAtlas();
                }
            },


            /**
             * Add data to the SpriteCache instance
             *
             * @param url {string} The url of the data object
             * @param value {json|image}
             */
            add: function (url, value) {
                addData(url, value);
            },


            /**
             * Get data from the SpriteCache instance
             * @param url {string} The url of the data object
             * @returns {json|Image}
             */
            get: function (url) {
                if (getData[url]) {
                    return getData[url];
                }
                return null;
            },

            /**
             *  Return the SpriteCache atlases
             *
             * @returns {Array} Atlases in cache
             */
            atlases: function () {
                return _atlases;
            },


            /**
             * Return the SpriteCache images
             *
             * @returns {Array} Images in cache
             */
            images: function () {
                return _images
            },


            /**
             * Flush a url or set of urls from the the SpriteCache. If no urls are passed ALL will be flushed
             * @param url {array|string} URLs of the atlases
             */
            flush: function (urls) {
                if (typeof urls === 'string') {
                    urls = [urls];
                }

                if (urls === undefined) {
                    _atlases = [];
                    _images = [];
                } else {
                    var url,
                        index;

                    for (index in urls) {
                        url = urls[index];
                        if (_atlases[url] !== undefined && _atlases[url].meta !== undefined) {
                            if (_images[_atlases[url].meta.image] !== undefined) {
                                delete _images[_atlases[url].meta.image];
                            }
                            delete _atlases[url];
                        }
                    }
                }
            },


            /**
             * Add a listener to the SpriteCache instance
             *
             * @param event {string} The event name
             * @param listener {function} The callback function
             * @param scope {object} The callback function's scope
             */
            on: function (event, listener, scope) {
                _eventDispatcher.on(event, listener, scope);
            },


            /**
             * Add a listener to the SpriteCache instance ONCE
             *
             * @param event {string} The event name
             * @param listener {function} The callback function
             * @param scope {object} The callback function's scope
             */
            one: function (event, listener, scope) {
                _eventDispatcher.one(event, listener, scope);
            },


            /**
             * Remove a listener of the SpriteCache instance
             *
             * @param event {string} The event name
             * @param listener {function} The callback function
             * @param scope {object} The callback function's scope
             */
            off: function (event, listener, scope) {
                _eventDispatcher.off(event, listener, scope);
            }

        };

        return SpriteCache._instance;

    };

    /**
     * SpriteCache singleton pattern
     *
     * @returns {{add: Function, get: Function, flush: Function}|*|SpriteCache}
     */
    SpriteCache.getInstance = function () {

        "use strict";

        return SpriteCache._instance || new SpriteCache();
    }


    return SpriteAnimation;

}));

