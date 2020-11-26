/* Notifications
 *
 * Provides an alternative notification system that combines wall notifications, announcements, and discussions notifications
 * Needs adding a small snippet of CSS in your global.css beforehand
 *
 * @author Dorumin
 */

(function() {
    if (
        !window.Promise ||
        window.Notifications && Notifications.init
    ) return;
    
    window.Notifications = $.extend({
        // Config
        pollInterval: 10000,
        // Local variables
        messageRegexes: {},
        // Resource management
        loaded: 6,
        onload: function(type, arg) {
            if (type == 'i18n') {
                arg.loadMessages('Notifications').then(this.onload.bind(this, 'locale'));
            }
            if (type == 'locale') {
                this.i18n = arg;
            }
            if (type == 'api') {
                this.api = new mw.Api();
                this.loadMessages().then(this.onload.bind(this));
            }
            if (--this.loaded) return;
            this.init();
        },
        // Utility
        parser: new DOMParser(),
        parse: function(xmlike) {
            return this.parser.parseFromString(xmlike, "text/html").body;
        },
        get: function(url) {
            return $.ajax({
                url: url,
                xhrFields: {
                    withCredentials: true
                }
            });
        },
        // Methods for dealing with stupid notification HTML
        processCountData: function(data) {
            var tree = this.parse(res.html),
            promises = [];
 
            tree
                .querySelectorAll('li[data-wiki-id]:not([data-unread-count="0"])')
                .forEach(function(node) {
                    promises.push(this.fetchLocalNotifications(this.getNodeWikiData(node)));
                }.bind(this));
 
            return $.when.apply(this, promises).then(this.normalizeNotifications.bind(this, data));
        },
        // Process data coming from wiki notifications
        processWikiData: function(wiki, res) {
            return {
                wiki: wiki,
                notifications: Array.from(this.parse(res.html).children)
                    .map(this.getNodeNotificationData)
            }
        },
        // Return a JSON data object from a wiki node
        getNodeWikiData: function(node) {
            return {
                id: node.getAttribute('data-wiki-id'),
                name: node.firstElementChild.firstChild.textContent.trim()
            };
        },
        // Return a JSON data object from a notification node
        getNodeNotificationData: function(node) {
            return {
                icon: node.querySelector('.avatar').src,
                title: node.querySelector('h4').textContent,
                content: node.querySelector('p').textContent,
                url: node.querySelector('a').href,
                date: node.querySelector('time').getAttribute('datetime')
            };
        },
        // Get local notifications from a wiki id
        fetchLocalNotifications: function(wiki) {
            return $.nirvana.getJson(
                "WallNotificationsExternal",
                "getUpdateWiki",
                {
                    wikiId: wiki.id
                }
            )
            .then(this.processWikiData.bind(this, wiki));
        },
        // Get wall and forum notifications, then parse them into a JSON structure
        fetchNormalizedNotifications: function() {
            return $.nirvana.getJson(
                "WallNotificationsExternal",
                "getUpdateCounts"
            )
            .then(this.processCountData.bind(this));
        },
        // Get all discussions-related notifications
        fetchDiscussionsNotifications: function() {
            return this.get('https://services.wikia.com/on-site-notifications/notifications?contentType=discussion-upvote&contentType=discussion-post&contentType=announcement-target');
        },
        // Get all notifications, unread or not
        fetchNotifications: function() {
            return Promise.all([
                this.fetchDiscussionsNotifications(),
                this.fetchNormalizedNotifications()
            ])
        },
        poll: function() {
            // TODO: use localStorage for syncing between tabs and avoid extra xhr
        },
        startPolling: function() {
            if (this.pollIntervalId) {
                throw new Error('startPolling called with this.pollIntervalId already being defined');
            }
            this.pollIntervalId = setInterval(this.poll, this.pollInterval);
            this.poll();
        },
        stopPolling: function() {
            if (!this.pollIntervalId) {
                throw new Error('stopPolling called wit this.pollIntervalId being falsy');
            }
            clearInterval(this.pollIntervalId);
            this.pollIntervalId = null;
        },
        // Bind events to start and stop polling notifications
        bindEvents: function() {
            window.addEventListener('focus', this.startPolling.bind(this));
            window.addEventListener('blur', this.stopPolling.bind(this));
            if (document.hasFocus()) {
                this.startPolling();
            }
        },
        // Escape regular expression tokens
        escapeRegex: function(text) {
            return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        },
        // Parse a mediawiki message into an usable regular expression
        buildRegex: function(text) {
            var seen = [];
            text = this.escapeRegex(text)
                .replace(/\\\$(\d+)/g, function(full, n) {
                    if (seen[n]) return '.*?';
                    seen[n] = true;
                    return '(.*?)';
                });
            return new RegExp(text);
        },
        // Load all necessary mw messages for matching later on
        loadMessages: function() {
            return $.when(
                this.api.get({
                    action: 'query',
                    meta: 'allmessages',
                    amprefix: 'wn-'
                }),
                this.api.get({
                    action: 'query',
                    meta: 'allmessages',
                    amprefix: 'forum-notification-'
                })
            )
            .then(function(wall, forum) {
                var allmessages = wall[0].query.allmessages.concat(forum[0].query.allmessages);
                allmessages.forEach(function(msg) {
                    this.messageRegexes[msg.name] = this.buildRegex(msg['*']);
                }, this);
            }.bind(this));
        },
        init: function() {
            this.bindEvents();
        }
    }, window.Notifications);

    mw.hook('dev.ui').add(Notifications.onload.bind(Notifications));
    mw.hook('dev.i18n').add(Notifications.onload.bind(Notifications, 'i18n'));
    mw.loader.using('mediawiki.api').then(Notifications.onload.bind(Notifications, 'api'));
    mw.loader.using(['jquery.timeago', 'ext.wikia.TimeAgoMessaging']).then(Notifications.onload.bind(Notifications));
 
    importArticle({
        type: 'style',
        article: 'u:dev:MediaWiki:Notifications.css'
    });
 
    importArticles({
        type: 'script',
        articles: [
            'u:dev:MediaWiki:I18n-js/code.js',
            'u:dev:MediaWiki:UI-js/code.js'
        ]
    });
})();
