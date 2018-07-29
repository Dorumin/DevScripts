/* HighlightsNotificationBubble
 *
 * Provides different ways to style the bubble on the notification icons relative to the current highlights
 *
 * @scope Personal
 * @author Dorumin
 */
 
(function highlightsNotificationBubbleInit(target) {
    if (!window.MutationObserver || !target) return;
    var config = window.HighlightsNotificationBubble || {
        all: {
            color: '#fff',
            bg_color: '#c5ff19'
        }
    };
 
    function on_mutation(does_it_really_matter_tho) {
        var bubbles = document.querySelector('#notificationsEntryPoint .bubbles');
        if (!bubbles || bubbles.className != 'bubbles show') return;
        var notification_list = document.querySelector('#notificationsContainer [data-wiki-id="' + wgCityId + '"]');
        if (!notification_list) return;
        var all_unread = notification_list.querySelectorAll('.unread'),
        all_highlights = notification_list.querySelectorAll('.unread.admin-notification');
        if (!all_unread || !all_highlights) return;
        if (config.all && all_highlights.length && all_unread.length == all_highlights.length) {
            add_styles('all');
        } else if (config.any && all_highlights.length) {
            add_styles('any');
        } else if (config.none && !all_highlights.length) {
            add_styles('none');
        } else {
            document.querySelector('.wds-global-navigation__notifications-menu-counter').removeAttribute('style');
        }
    }
 
    function add_styles(mode) {
        var counter = document.querySelector('.wds-global-navigation__notifications-menu-counter');
        counter.removeAttribute('style');
        counter.style.color = config[mode].color;
        counter.style.backgroundColor = config[mode].bg_color;
    }
 
    var observer = new MutationObserver(on_mutation);
 
    observer.observe(target, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true // Don't worry, no chance of infinite loops here... I hope
    });
 
    on_mutation('no it does not matter');
})(document.getElementById('GlobalNavigationWallNotifications'));