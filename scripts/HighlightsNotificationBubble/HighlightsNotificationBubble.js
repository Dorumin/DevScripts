/* HighlightsNotificationBubble
 *
 * Provides different ways to style the bubble on the notification icons relative to the current highlights
 * *ahem* Did I say highlights? I meant, announcements! Of course, how could I forget? Those things that follow you around everywhere and you can't dismiss without a script? Ah, they're my favorite
 *
 * @author Dorumin
 */
 
(function() {
    if (
        !window.MutationObserver ||
        (window.HighlightsNotificationBubble && HighlightsNotificationBubble.init)
    ) return;
 
    window.HighlightsNotificationBubble = $.extend({
        observer: null,
        target: document.getElementById('globalNavigation'),
        id: mw.config.get('wgCityId'),
        config: {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true // Infinite loops shall not pass
        },
        all: {
            color: '#fff',
            background: '#ffc500'
        },
        // Yes, this returns if 0 == 0, but who cares?
        getStyles: function(all, special) {
            var navigation = document.getElementById('globalNavigation'),
            highlights = navigation.querySelectorAll(special),
            notifications = navigation.querySelectorAll(all);
 
            if (highlights.length == notifications.length) {
                return this.all;
            } else if (highlights.length) {
                return this.any;
            } else {
                return this.none;
            }
        },
        styleBubble(bubble, styles) {
            if (!styles) return;
 
            // Silly past me, all in for snake_case and willing to show it off at any opportunity
            styles.background = styles.background || styles.bg_color;
 
            for (var property in styles) {
                var value = styles[property];
                if (bubble.style[property] != value) {
                    bubble.style[property] = value;
                }
            }
        },
        // Calls twice after changing colors but not like that matters
        onMutation: function() {
            var announcementsBubble = document.getElementById('onSiteNotificationsCount'),
            highlightsBubble = document.querySelector('#notificationsEntryPoint .wds-global-navigation__notifications-counter');
 
            this.styleBubble(announcementsBubble, this.getStyles(
                    '.wds-notification-card.wds-is-unread',
                    '.wds-notification-card.wds-is-unread[data-type="announcement"]'
            ));
 
            this.styleBubble(highlightsBubble, this.getStyles(
                '#notificationsContainer li[data-wiki-id="' + this.id + '"] .notification.unread',
                '#notificationsContainer li[data-wiki-id="' + this.id + '"] .notification.unread.admin-notification'
            ));
        },
        init: function() {
            this.observer = new MutationObserver(this.onMutation.bind(this));
 
            this.observer.observe(this.target, this.config);
 
            this.onMutation();
        }
    }, window.HighlightsNotificationBubble);
 
    HighlightsNotificationBubble.init();
})();