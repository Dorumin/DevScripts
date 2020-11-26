window.ui = (function() {
    // I did make some pretty cool code that generated these from window class objects
    // but having a predefined set is probably shorter, neater, and a better idea anyway
    var htmlTags = [
        'video',
        'title',
        'textarea',
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
        'img',
        // tables
        'table',
        'tbody',
        'th',
        'tr',
        'td',
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
                        elem[key] = value[key];
                    }
                    break;
                case 'tag':
                    break;

                default:
                    elem.setAttribute(key, value);
            }
        }

        return elem;
    };

    for (var i in svgTags) {
        var tag = svgTags[i];

        // Closure because JavaScript and `var`
        (function(tag) {
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
        (function(tag) {
            ui[tag] = function(options) {
                options = options || {};
                options.tag = tag;

                return ui(options, false);
            };
        })(tag);
    }

    return ui;
})();
