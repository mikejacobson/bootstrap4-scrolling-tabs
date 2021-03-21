/* exported buildNavTabsAndTabContentForTargetElementInstance */
var tabElements = (function () {

  return {
    getElTabPaneForLi: getElTabPaneForLi,
    getNewElNavTabs: getNewElNavTabs,
    getNewElScrollerElementWrappingNavTabsInstance: getNewElScrollerElementWrappingNavTabsInstance,
    getNewElTabAnchor: getNewElTabAnchor,
    getNewElTabContent: getNewElTabContent,
    getNewElTabLi: getNewElTabLi,
    getNewElTabPane: getNewElTabPane
  };

  ///////////////////

  // ---- retrieve existing elements from the DOM ----------
  function getElTabPaneForLi($li) {
    return $($li.find('a').attr('href'));
  }


  // ---- create new elements ----------
  function getNewElNavTabs() {
    return $('<ul class="nav nav-tabs" role="tablist"></ul>');
  }

  function getDefaultLeftArrow(settings) {
    return [
      '<div class="scrtabs-tab-scroll-arrow scrtabs-tab-scroll-arrow-left">',
      '  <span class="' + settings.cssClassLeftArrow + '"></span>',
      '</div>'
    ].join('');
  }

  function getDefaultRightArrow(settings) {
    return [
      '<div class="scrtabs-tab-scroll-arrow scrtabs-tab-scroll-arrow-right">',
      '  <span class="' + settings.cssClassRightArrow + '"></span>',
      '</div>'
    ].join('');
  }

  function getTabContainerHtml() {
    return '<div class="scrtabs-tab-container"></div>';
  }

  function getFixedContainerHtml() {
    return '<div class="scrtabs-tabs-fixed-container"></div>';
  }

  function getMovableContainerHtml() {
    return '<div class="scrtabs-tabs-movable-container"></div>';
  }

  function getNewElScrollerElementWrappingNavTabsInstance($navTabsInstance, settings) {
    var $tabsContainer = $(getTabContainerHtml());
    var leftArrowContent = settings.leftArrowContent || getDefaultLeftArrow(settings);
    var $leftArrow = $(leftArrowContent);
    var rightArrowContent = settings.rightArrowContent || getDefaultRightArrow(settings);
    var $rightArrow = $(rightArrowContent);
    var $fixedContainer = $(getFixedContainerHtml());
    var $movableContainer = $(getMovableContainerHtml());

    if (settings.disableScrollArrowsOnFullyScrolled) {
      $leftArrow.add($rightArrow).addClass(CONSTANTS.CSS_CLASSES.SCROLL_ARROW_DISABLE);
    }

    return $tabsContainer
              .append($leftArrow,
                      $fixedContainer.append($movableContainer.append($navTabsInstance)),
                      $rightArrow);
  }

  function getTabAnchorHtml() {
    return '<a class="nav-link" role="tab" data-toggle="tab"></a>';
  }

  function getNewElTabAnchor(tab, propNames) {
    return $(getTabAnchorHtml())
            .attr('href', '#' + tab[propNames.paneId])
            .html(tab[propNames.title]);
  }

  function getNewElTabContent() {
    return $('<div class="tab-content"></div>');
  }

  function getDefaultTabLiHtml() {
    return '<li class="nav-item"></li>';
  }

  function getNewElTabLi(tab, propNames, options) {
    var liContent = options.tabLiContent || getDefaultTabLiHtml();
    var $li = $(liContent);
    var $a = getNewElTabAnchor(tab, propNames).appendTo($li);

    if (tab[propNames.disabled]) {
      $a.addClass('disabled');
      $a.attr('data-toggle', '');
    } else if (options.forceActiveTab && tab[propNames.active]) {
      $a.addClass('active');
    }

    if (options.tabPostProcessor) {
      options.tabPostProcessor($li, $a);
    }

    return $li;
  }

  function getNewElTabPane(tab, propNames, options) {
    var $pane = $('<div role="tabpanel" class="tab-pane fade show"></div>')
                .attr('id', tab[propNames.paneId])
                .html(tab[propNames.content]);

    if (options.forceActiveTab && tab[propNames.active]) {
      $pane.addClass('active');
    }

    return $pane;
  }


}()); // tabElements

var tabUtils = (function () {

  return {
    didTabOrderChange: didTabOrderChange,
    getIndexOfClosestEnabledTab: getIndexOfClosestEnabledTab,
    getTabIndexByPaneId: getTabIndexByPaneId,
    storeDataOnLiEl: storeDataOnLiEl
  };

  ///////////////////

  function didTabOrderChange($currTabLis, updatedTabs, propNames) {
    var isTabOrderChanged = false;

    $currTabLis.each(function (currDomIdx) {
      var newIdx = getTabIndexByPaneId(updatedTabs, propNames.paneId, $(this).data('tab')[propNames.paneId]);

      if ((newIdx > -1) && (newIdx !== currDomIdx)) { // tab moved
        isTabOrderChanged = true;
        return false; // exit .each() loop
      }
    });

    return isTabOrderChanged;
  }

  function getIndexOfClosestEnabledTab($currTabLis, startIndex) {
    var lastIndex = $currTabLis.length - 1;
    var closestIdx = -1;
    var incrementFromStartIndex = 0;
    var testIdx = 0;

    // expand out from the current tab looking for an enabled tab;
    // we prefer the tab after us over the tab before
    while ((closestIdx === -1) && (testIdx >= 0)) {

      if ( (((testIdx = startIndex + (++incrementFromStartIndex)) <= lastIndex) &&
            !$currTabLis.eq(testIdx).hasClass('disabled')) ||
            (((testIdx = startIndex - incrementFromStartIndex) >= 0) &&
             !$currTabLis.eq(testIdx).hasClass('disabled')) ) {
        closestIdx = testIdx;
      }
    }

    return closestIdx;
  }

  function getTabIndexByPaneId(tabs, paneIdPropName, paneId) {
    var idx = -1;

    tabs.some(function (tab, i) {
      if (tab[paneIdPropName] === paneId) {
        idx = i;
        return true; // exit loop
      }
    });

    return idx;
  }

  function storeDataOnLiEl($li, tabs, index) {
    $li.data({
      tab: $.extend({}, tabs[index]), // store a clone so we can check for changes
      index: index
    });
  }

}()); // tabUtils

function buildNavTabsAndTabContentForTargetElementInstance($targetElInstance, settings, readyCallback) {
  var tabs = settings.tabs;
  var propNames = {
    paneId: settings.propPaneId,
    title: settings.propTitle,
    active: settings.propActive,
    disabled: settings.propDisabled,
    content: settings.propContent
  };
  var ignoreTabPanes = settings.ignoreTabPanes;
  var hasTabContent = tabs.length && tabs[0][propNames.content] !== undefined;
  var $navTabs = tabElements.getNewElNavTabs();
  var $tabContent = tabElements.getNewElTabContent();
  var $scroller;
  var attachTabContentToDomCallback = ignoreTabPanes ? null : function() {
    $scroller.after($tabContent);
  };

  if (!tabs.length) {
    return;
  }

  tabs.forEach(function(tab, index) {
    var options = {
      forceActiveTab: true,
      tabLiContent: settings.tabsLiContent && settings.tabsLiContent[index],
      tabPostProcessor: settings.tabsPostProcessors && settings.tabsPostProcessors[index]
    };

    tabElements
      .getNewElTabLi(tab, propNames, options)
      .appendTo($navTabs);

    // build the tab panes if we weren't told to ignore them and there's
    // tab content data available
    if (!ignoreTabPanes && hasTabContent) {
      tabElements
        .getNewElTabPane(tab, propNames, options)
        .appendTo($tabContent);
    }
  });

  $scroller = wrapNavTabsInstanceInScroller($navTabs,
                                            settings,
                                            readyCallback,
                                            attachTabContentToDomCallback);

  $scroller.appendTo($targetElInstance);

  $targetElInstance.data({
    scrtabs: {
      tabs: tabs,
      propNames: propNames,
      ignoreTabPanes: ignoreTabPanes,
      hasTabContent: hasTabContent,
      tabsLiContent: settings.tabsLiContent,
      tabsPostProcessors: settings.tabsPostProcessors,
      scroller: $scroller
    }
  });

  // once the nav-tabs are wrapped in the scroller, attach each tab's
  // data to it for reference later; we need to wait till they're
  // wrapped in the scroller because we wrap a *clone* of the nav-tabs
  // we built above, not the original nav-tabs
  $scroller.find('.nav-tabs > li').each(function (index) {
    tabUtils.storeDataOnLiEl($(this), tabs, index);
  });

  return $targetElInstance;
}


function wrapNavTabsInstanceInScroller($navTabsInstance, settings, readyCallback, attachTabContentToDomCallback) {
  // Remove tab data stored by Bootstrap in order to fix tabs that were already visited
  $navTabsInstance
    .find('a[data-toggle="tab"]')
    .removeData(CONSTANTS.DATA_KEY_BOOTSTRAP_TAB);
  
  var $scroller = tabElements.getNewElScrollerElementWrappingNavTabsInstance($navTabsInstance.clone(true), settings); // use clone because we replaceWith later
  var scrollingTabsControl = new ScrollingTabsControl($scroller);
  var navTabsInstanceData = $navTabsInstance.data('scrtabs');

  if (!navTabsInstanceData) {
    $navTabsInstance.data('scrtabs', {
      scroller: $scroller
    });
  } else {
    navTabsInstanceData.scroller = $scroller;
  }

  $navTabsInstance.replaceWith($scroller.css('visibility', 'hidden'));

  if (settings.tabClickHandler && (typeof settings.tabClickHandler === 'function')) {
    $scroller.hasTabClickHandler = true;
    scrollingTabsControl.tabClickHandler = settings.tabClickHandler;
  }

  $scroller.initTabs = function () {
    scrollingTabsControl.initTabs(settings,
                                  $scroller,
                                  readyCallback,
                                  attachTabContentToDomCallback);
  };

  $scroller.scrollToActiveTab = function() {
    scrollingTabsControl.scrollToActiveTab(settings);
  };

  $scroller.initTabs();

  listenForDropdownMenuTabs($scroller, scrollingTabsControl);

  return $scroller;
}
