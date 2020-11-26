/*
 * FavoriteWikisPersistTab
 *
 * Does a script with a name that verbose need a description?
 * Persists the selected user tab when clicking favorite wiki links.
 *
 * @author Dorumin
 */
 
(function() {
    var $wikis = $('#UserProfileMasthead .wikis > ul > li > a');
    if (!$wikis.exists()) return;
 
    function replace_links(page) {
        $wikis.each(function() {
            var $this = $(this),
            href = $this.attr('href'),
            path = '/wiki/' + page.replace('$1', href.split('User_talk:')[1]);
            $this.attr('href', href.replace(/\/wiki\/.+/, path));
        });
    }
 
    if (wgNamespaceNumber == 2) {
        replace_links('User:$1');
    } else if (wgNamespaceNumber == 500) {
        replace_links('User_blog:$1');
    } else if (wgCanonicalSpecialPageName == 'Contributions') {
        replace_links('Special:Contributions/$1');
    } else if (wgCanonicalSpecialPageName == 'Following') {
        replace_links('Special:Following');
    }
    // User talk is default, Special:UserActivity is CC only
})();