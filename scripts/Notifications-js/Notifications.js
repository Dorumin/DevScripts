/*
 * Notifications-js
 *
 * Provides a higher-level abstraction over creating, persisting, and marking Fadnom notifications as read
 *
 * There are no typos in this header
 *
 * @author Dorumin
 *
 */

(function() {
    // You know, double loads
    if (window.dev && window.dev.notifications && window.dev.notifications.loaded) {
        return;
    }

    // Something perhaps a little controversial: my own fork of [[UI-js]]
    // Massive props to Kocka for the awesome library, but I like mine better,
    // and I feel like having no extra dependencies with libraries is somewhat valuable
    //
    // Changes:
    // - Attributes can be directly in the object, unless they have special meaning (there's still an attrs property to make it explicit)
    // - Building tags have a shorthand ui.tag() function, for unsupported native calls, you can still do ui({ tag: 'div' })
    // - Style attribute setting supports custom CSS properties. Doesn't actually matter, but y'know
    // - child: property so you don't always have to set an array. Don't use it alongside children:
    // - child: and children: properties expect ready-to-use nodes, they aren't thrown through ui() first; exception being strings, turned into text nodes for children:
    // - classes: supports a plain object for conditional classes
    // - Conditional children should not use condition:, they should be used with a short-circuit && as child operations check for truthiness
    //   - e.g., child: hasChild && ui.button({ text: 'Click me!' })
    //
    // I considered using proxies for the shorthand methods, but a second later figured that would be a really stupid idea
    window.ui = (function() {
        // I did make some pretty cool code that generated these from window class objects
        // but having a predefined set is probably shorter, neater, and a better idea anyway
        var htmlTags = [
            'video',
            'title',
            'textarea',
            'table',
            'style',
            'span',
            'select',
            'script',
            'pre',
            'link',
            'label',
            'li',
            'input',
            'iframe',
            'html',
            'head',
            'form',
            'div',
            'canvas',
            'button',
            'body',
            'audio',
            'img'
        ];
        var svgTags = [
            'use',
            'text',
            'style',
            'script',
            'svg',
            'line',
            'image',
            'geometry',
            'g',
            'ellipse',
            'desc',
            'defs',
            'clippath',
            'circle',
            'animation',
            'animate',
            'a'
        ];

        var ui = function(options, isSVG) {
            if (!options.tag) throw new Error('No tag');

            // Made explicit for performance
            // var elem;
            // if (htmlTags.includes(options.tag) || !svgTags.includes(options.tag)) {
            //     elem = document.createElement(options.tag);
            // } else {
            //     elem = document.createElementNS(
            //         'http://www.w3.org/2000/svg',
            //         options.tag
            //     );
            // }
            var elem;
            if (isSVG) {
                elem = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    options.tag
                );
            } else {
                elem = document.createElement(options.tag);
            }

            for (var key in options) {
                const value = options[key];

                switch (key) {
                    case 'html':
                        elem.innerHTML = value;
                        break;
                    case 'text':
                        elem.appendChild(document.createTextNode(value));
                        break;
                    case 'child':
                        // Text unsupported, obviously; use text:
                        if (value) {
                            elem.appendChild(value);
                        }
                        break;
                    case 'children':
                        for (var i in value) {
                            var child = value[i];

                            if (child) {
                                if (typeof child === 'string') {
                                    elem.appendChild(document.createTextNode(child));
                                } else {
                                    elem.appendChild(child);
                                }
                            }
                        }
                        break;
                    case 'classes':
                        if (value instanceof Array) {
                            elem.setAttribute('class', value.join(' '));
                        } else {
                            for (var key in value) {
                                var v = value[key];

                                if (v) {
                                    elem.classList.add(key);
                                }
                            }
                        }
                        break;
                    case 'events':
                        for (var key in value) {
                            elem.addEventListener(key, value[key]);
                        }
                        break;
                    case 'style':
                        for (var key in value) {
                            let propName = key.replace(/[A-Z]/gm, (c) => `-${c.toLowerCase()}`);

                            if (propName.slice(0, 3) == 'ms-') {
                                propName = '-' + propName;
                            }
                            const v = value[key];
                            const isImportant = v.trim().slice(-10) == '!important';
                            const val = isImportant
                                ? v.slice(0, -10)
                                : v;

                            elem.style.setProperty(propName, val, isImportant ? 'important' : '');
                        }
                        break;
                    case 'props':
                        for (var key in value) {
                            elem[key] = valvalue[key];
                        }
                        break;
                    case 'tag':
                        break;

                    default:
                        elem.setAttribute(property, val);
                }
            }

            return elem;
        };

        for (var i in svgTags) {
            var tag = svgTags[i];

            // Closure because JavaScript and `var`
            (function() {
                ui[tag] = function(options) {
                    options = options || {};
                    options.tag = tag;

                    return ui(options, true);
                };
            })(tag);
        }

        for (var i in htmlTags) {
            var tag = htmlTags[i];

            // Closure because JavaScript and `var`
            (function() {
                ui[tag] = function(options) {
                    options = options || {};
                    options.tag = tag;

                    return ui(options, false);
                };
            })(tag);
        }

        return ui;
    })();

    var WATCH_URL_PREFIX = 'https://services.fandom.com/on-site-notifications/notifications';

    window.dev = window.dev || {};
    dev.notifications = {
        loaded: true,
        ui: ui,
        _listeners: {},
        on: function(event, callback) {
            if (!this._listeners.hasOwnProperty(event)) {
                this._listeners[event] = [];
            }

            this._listeners[event].push(callback);
        },
        off: function(event, callback) {
            if (!this._listeners.hasOwnProperty(event)) {
                this._listeners[event] = [];
            }

            if (callback) {
                var index = this._listeners[event].indexOf(callback);

                if (index !== -1) {
                    this._listeners[event].splice(index, 1);
                    return true;
                } else {
                    return false;
                }
            } else {
                this._listeners[event] = [];
                return true;
            }
        },
        emit: function(event, value) {
            if (!this._listeners.hasOwnProperty(event)) {
                this._listeners[event] = [];
            }

            var listeners = this._listeners[event];
            for (var i = 0; i < listeners.length; i++) {
                listeners[i](value);
            }
        },
        buildNotification: function(props) {

        },
        add: function(props) {

        },
        interceptRequest: function(data) {
            console.log('Intercepted', data);

            this.emit('hydrate', data);

            return data;
        },
        patchAjax: function() {
            var lib = this;
            var oldAjax = $.ajax;
            $.ajax = function(options) {
                var result = oldAjax.apply(this, arguments);

                if (options && options.url && options.url.slice(0, WATCH_URL_PREFIX.length) === WATCH_URL_PREFIX) {
                    result = result.then(lib.interceptRequest.bind(lib));
                }

                return result;
            };
        },
        init: function() {
            this.patchAjax();
        }
    };


    dev.notifications.init();
})();
