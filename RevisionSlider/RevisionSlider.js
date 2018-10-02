/* RevisionSlider
 *
 * Adds a revision slider to diff and history pages
 * Ported from the extension developed for the German Wikipedia
 * 
 * @author Dorumin
 */

 (function() {
    var config = window.RevisionSlider || {},
    diff = $.getUrlVar('diff'),
    action = $.getUrlVar('action');
    config.load = config.load || { diff: true, history: true };

    if (
        (
            (!diff || !config.load.diff) &&
            (action != 'history' || !config.load.history)
        ) ||
        config.init
    ) return;

    RevisionSlider = $.extend({
        _loads: 0,
        settings: JSON.parse(localStorage.getItem('RevisionSlider-settings') || '{}'),
        preload: function() {
            if (++this._loads == 3) {
                this.init();
            }
        },
        i18n: function(lib) {
            lib.loadMessages('RevisionSlider').then(this.cbI18n.bind(this));
        },
        cbI18n: function(i18n) {
            this.i18n = i18n;
            i18n.useUserLang();
            this.preload();
        },
        config: function(key, value) {
            this.settings[key] = value;
            localStorage.setItem('RevisionSlider-settings', JSON.stringify(this.settings));
        },
        toggleSlider: function() {
            var value = this.container.classList.toggle('revslider-expanded');
        },
        onHeaderClick: function(e) {
            if (!e.target.closest('.revslider-pin')) {
                e.preventDefault();
                this.toggleSlider();
            }
        },
        onPinClick: function(e) {
            e.preventDefault();
            this._pinbutton.classList.toggle('always-expand');
            this.config('pin', !this.settings.pin);
        },
        render: function() {
            this.container = dev.ui({
                type: 'div',
                classes: ['revslider-container'],
                children: [
                    this._header = dev.ui({
                        type: 'div',
                        classes: ['revslider-header'],
                        attr: {
                            title: this.i18n.msg('toggle-title-collapsed').plain()
                        },
                        events: {
                            click: this.onHeaderClick.bind(this)
                        },
                        children: [
                            {
                                type: 'span',
                                classes: ['revslider-header-text'],
                                text: this.i18n.msg('header-text').plain()
                            },
                            this._pinbutton = dev.ui({
                                type: 'div',
                                classes: ['revslider-icon', 'revslider-pin'].concat(this.settings.pin ? ['always-expand'] : []),
                                attr: {
                                    title: this.i18n.msg('always-expand').plain()
                                },
                                events: {
                                    click: this.onPinClick.bind(this)
                                },
                                children: [{
                                    type: 'svg',
                                    attr: {
                                        width: 26,
                                        height: 26,
                                        viewBox: '0 0 283.67461 328.56086'
                                    },
                                    children: [{
                                        type: 'path',
                                        attr: {
                                            d: 'M112.037 183.315l13.081 10.638c-19.395 23.495-35.637 38.18-51.396 51.511 11.553-22.015 23.876-43.21 38.315-62.15zM165.5 82.242c-3.145 6.995-8.094 11.658 1.072 23.75-12.936 17.401-30.214 31.916-47.857 46.963-13.992-8.578-23.804-18.506-45.358-9.285l49.564 39.9 49.19 40.356c4.62-22.984-7.104-30.56-18.361-42.502 11.122-20.347 21.8-40.227 36.19-56.447 13.71 6.5 17.262.701 23.466-3.807-17.04-13.51-32.144-26.132-47.906-38.928z'
                                        }
                                    }]
                                }]
                            }),
                            {
                                type: 'div',
                                classes: ['revslider-icon', 'revslider-toggle'],
                            }
                        ]
                    }),
                    {
                        type: 'div',
                        classes: ['revslider-wrapper'],
                        children: [
                            {
                                type: 'div',
                                classes: ['revslider-arrow-back'],
                                children: []
                            },
                            {
                                type: 'div',
                                classes: ['revslider-revisions-wrapper'],
                                children: []
                            },
                            {
                                type: 'div',
                                classes: ['revslider-arrow-forward'],
                                children: []
                            }
                        ]
                    }
                ]
            });

            var content = document.getElementById('mw-content-text');
            if (!content) return;

            content.insertBefore(this.container, content.firstChild);

            this.afterRender();
        },
        afterRender: function() {
            if (this.settings.pinned) {
                this.toggleSlider();
            }
        },
        init: function() {
            console.log(this);
            this.api = new mw.Api();
            this.render();

        }
    }, window.RevisionSlider);

    importArticles(
        {
            type: 'script',
            articles: [
                'u:dev:MediaWiki:I18n-js/code.js',
                'u:dev:MediaWiki:UI-js/code.js'
            ]
        },
        {
            type: 'style',
            articles: [
                'u:dev:MediaWiki:RevisionSlider.css'
            ]
        }
    );

    mw.hook('dev.i18n').add(RevisionSlider.i18n.bind(RevisionSlider));
    mw.hook('dev.ui').add(RevisionSlider.preload.bind(RevisionSlider));
    mw.loader.using('mediawiki.api').then(RevisionSlider.preload.bind(RevisionSlider));
 })();


 // Add the css when copy pasting, please don't push this to the actual dev wiki page pls future me
 mw.util.addCSS(`.revslider-container {
    border: 1px solid #ccc;
}

.revslider-wrapper {
    display: none;
}

.revslider-header {
    display: flex;
    align-items: center;
    cursor: pointer;
    height: 32px;
}

.revslider-header-text {
    font-weight: bold;
    flex: 1;
    text-align: center;
}

.revslider-icon {
    height: 26px;
    width: 26px;
    margin-right: 4px;
    background-repeat: no-repeat;
    background-position: center center;
}

.revslider-toggle {
    background-image: linear-gradient(transparent,transparent),url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 20 20%22%3E%3Ctitle%3Eexpand%3C/title%3E%3Cpath d=%22M19 6.25l-1.5-1.5-7.5 7.5-7.5-7.5L1 6.25l9 9 9-9z%22/%3E%3C/svg%3E");
    transition: transform 200ms ease-in-out;
}

.revslider-expanded .revslider-toggle {
    transform: rotate(-180deg);
}

.revslider-expanded .revslider-wrapper {
    display: block;
}

.revslider-pin {
    visibility: hidden;
    border-radius: 4px;
    background: white;
    transition: background 300ms ease;
}

.revslider-expanded .revslider-pin {
    visibility: visible;
}

.revslider-pin svg {
    fill: black;
    transition: fill 300ms ease;
}

.revslider-pin.always-expand {
    background: #2a4b8d;
}

.revslider-pin.always-expand svg {
    fill: white;
}`);