/**
 * bootstrap4-scrolling-tabs
 * @version v1.0.0
 * @link https://github.com/mikejacobson/bootstrap4-scrolling-tabs
 * @author Mike Jacobson <michaeljjacobson1@gmail.com>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
;(function ($, window) {
  'use strict';
  /* jshint unused:false */

  /* exported CONSTANTS */
  var CONSTANTS = {
    CONTINUOUS_SCROLLING_TIMEOUT_INTERVAL: 50, // timeout interval for repeatedly moving the tabs container
                                                // by one increment while the mouse is held down--decrease to
                                                // make mousedown continous scrolling faster
    SCROLL_OFFSET_FRACTION: 6, // each click moves the container this fraction of the fixed container--decrease
                               // to make the tabs scroll farther per click
  
    DATA_KEY_DDMENU_MODIFIED: 'scrtabsddmenumodified',
    DATA_KEY_IS_MOUSEDOWN: 'scrtabsismousedown',
    DATA_KEY_BOOTSTRAP_TAB: 'bs.tab',
  
    CSS_CLASSES: {
      BOOTSTRAP4: 'scrtabs-bootstrap4',
      RTL: 'scrtabs-rtl',
      SCROLL_ARROW_CLICK_TARGET: 'scrtabs-click-target',
      SCROLL_ARROW_DISABLE: 'scrtabs-disable',
      SCROLL_ARROW_WITH_CLICK_TARGET: 'scrtabs-with-click-target'
    },
  
    SLIDE_DIRECTION: {
      LEFT: 1,
      RIGHT: 2
    },
  
    EVENTS: {
      CLICK: 'click.scrtabs',
      DROPDOWN_MENU_HIDE: 'hide.bs.dropdown.scrtabs',
      DROPDOWN_MENU_SHOW: 'show.bs.dropdown.scrtabs',
      FORCE_REFRESH: 'forcerefresh.scrtabs',
      MOUSEDOWN: 'mousedown.scrtabs',
      MOUSEUP: 'mouseup.scrtabs',
      TABS_READY: 'ready.scrtabs',
      TOUCH_END: 'touchend.scrtabs',
      TOUCH_MOVE: 'touchmove.scrtabs',
      TOUCH_START: 'touchstart.scrtabs',
      WINDOW_RESIZE: 'resize.scrtabs'
    }
  };
  
  // smartresize from Paul Irish (debounced window resize)
  (function (sr) {
    var debounce = function (func, threshold, execAsap) {
      var timeout;
  
      return function debounced() {
        var obj = this, args = arguments;
        function delayed() {
          if (!execAsap) {
            func.apply(obj, args);
          }
          timeout = null;
        }
  
        if (timeout) {
          clearTimeout(timeout);
        } else if (execAsap) {
          func.apply(obj, args);
        }
  
        timeout = setTimeout(delayed, threshold || 100);
      };
    };
    $.fn[sr] = function (fn, customEventName) {
      var eventName = customEventName || CONSTANTS.EVENTS.WINDOW_RESIZE;
      return fn ? this.bind(eventName, debounce(fn)) : this.trigger(sr);
    };
  
  })('smartresizeScrtabs');
  
  /* ***********************************************************************************
   * ElementsHandler - Class that each instance of ScrollingTabsControl will instantiate
   * **********************************************************************************/
  function ElementsHandler(scrollingTabsControl) {
    var ehd = this;
  
    ehd.stc = scrollingTabsControl;
  }
  
  // ElementsHandler prototype methods
  (function (p) {
      p.initElements = function (options) {
        var ehd = this;
  
        ehd.setElementReferences(options);
        ehd.setEventListeners(options);
      };
  
      p.listenForTouchEvents = function () {
        var ehd = this,
            stc = ehd.stc,
            smv = stc.scrollMovement,
            ev = CONSTANTS.EVENTS;
  
        var touching = false;
        var touchStartX;
        var startingContainerLeftPos;
        var newLeftPos;
  
        stc.$movableContainer
          .on(ev.TOUCH_START, function (e) {
            touching = true;
            startingContainerLeftPos = stc.movableContainerLeftPos;
            touchStartX = e.originalEvent.changedTouches[0].pageX;
          })
          .on(ev.TOUCH_END, function () {
            touching = false;
          })
          .on(ev.TOUCH_MOVE, function (e) {
            if (!touching) {
              return;
            }
  
            var touchPageX = e.originalEvent.changedTouches[0].pageX;
            var diff = touchPageX - touchStartX;
            if (stc.rtl) {
              diff = -diff;
            }
            var minPos;
  
            newLeftPos = startingContainerLeftPos + diff;
            if (newLeftPos > 0) {
              newLeftPos = 0;
            } else {
              minPos = smv.getMinPos();
              if (newLeftPos < minPos) {
                newLeftPos = minPos;
              }
            }
            stc.movableContainerLeftPos = newLeftPos;
  
            var leftOrRight = stc.rtl ? 'right' : 'left';
            stc.$movableContainer.css(leftOrRight, smv.getMovableContainerCssLeftVal());
            smv.refreshScrollArrowsDisabledState();
          });
      };
  
      p.refreshAllElementSizes = function () {
        var ehd = this,
            stc = ehd.stc,
            smv = stc.scrollMovement,
            scrollArrowsWereVisible = stc.scrollArrowsVisible,
            actionsTaken = {
              didScrollToActiveTab: false
            },
            isPerformingSlideAnim = false,
            minPos;
  
        ehd.setElementWidths();
        ehd.setScrollArrowVisibility();
  
        // this could have been a window resize or the removal of a
        // dynamic tab, so make sure the movable container is positioned
        // correctly because, if it is far to the left and we increased the
        // window width, it's possible that the tabs will be too far left,
        // beyond the min pos.
        if (stc.scrollArrowsVisible) {
          // make sure container not too far left
          minPos = smv.getMinPos();
  
          isPerformingSlideAnim = smv.scrollToActiveTab({
            isOnWindowResize: true
          });
  
          if (!isPerformingSlideAnim) {
            smv.refreshScrollArrowsDisabledState();
  
            if (stc.rtl) {
              if (stc.movableContainerRightPos < minPos) {
                smv.incrementMovableContainerLeft(minPos);
              }
            } else {
              if (stc.movableContainerLeftPos < minPos) {
                smv.incrementMovableContainerRight(minPos);
              }
            }
          }
  
          actionsTaken.didScrollToActiveTab = true;
  
        } else if (scrollArrowsWereVisible) {
          // scroll arrows went away after resize, so position movable container at 0
          stc.movableContainerLeftPos = 0;
          smv.slideMovableContainerToLeftPos();
        }
  
        return actionsTaken;
      };
  
      p.setElementReferences = function (settings) {
        var ehd = this,
            stc = ehd.stc,
            $tabsContainer = stc.$tabsContainer,
            $leftArrow,
            $rightArrow,
            $leftArrowClickTarget,
            $rightArrowClickTarget;
  
        stc.isNavPills = false;
  
        if (stc.rtl) {
          $tabsContainer.addClass(CONSTANTS.CSS_CLASSES.RTL);
        }
  
        if (stc.usingBootstrap4) {
          $tabsContainer.addClass(CONSTANTS.CSS_CLASSES.BOOTSTRAP4);
        }
  
        stc.$fixedContainer = $tabsContainer.find('.scrtabs-tabs-fixed-container');
        $leftArrow = stc.$fixedContainer.prev();
        $rightArrow = stc.$fixedContainer.next();
  
        // if we have custom arrow content, we might have a click target defined
        if (settings.leftArrowContent) {
          $leftArrowClickTarget = $leftArrow.find('.' + CONSTANTS.CSS_CLASSES.SCROLL_ARROW_CLICK_TARGET);
        }
  
        if (settings.rightArrowContent) {
          $rightArrowClickTarget = $rightArrow.find('.' + CONSTANTS.CSS_CLASSES.SCROLL_ARROW_CLICK_TARGET);
        }
  
        if ($leftArrowClickTarget && $leftArrowClickTarget.length) {
          $leftArrow.addClass(CONSTANTS.CSS_CLASSES.SCROLL_ARROW_WITH_CLICK_TARGET);
        } else {
          $leftArrowClickTarget = $leftArrow;
        }
  
        if ($rightArrowClickTarget && $rightArrowClickTarget.length) {
          $rightArrow.addClass(CONSTANTS.CSS_CLASSES.SCROLL_ARROW_WITH_CLICK_TARGET);
        } else {
          $rightArrowClickTarget = $rightArrow;
        }
  
        stc.$movableContainer = $tabsContainer.find('.scrtabs-tabs-movable-container');
        stc.$tabsUl = $tabsContainer.find('.nav-tabs');
  
        // check for pills
        if (!stc.$tabsUl.length) {
          stc.$tabsUl = $tabsContainer.find('.nav-pills');
  
          if (stc.$tabsUl.length) {
            stc.isNavPills = true;
          }
        }
  
        stc.$tabsLiCollection = stc.$tabsUl.find('> li');
  
        stc.$slideLeftArrow = stc.reverseScroll ? $leftArrow : $rightArrow;
        stc.$slideLeftArrowClickTarget = stc.reverseScroll ? $leftArrowClickTarget : $rightArrowClickTarget;
        stc.$slideRightArrow = stc.reverseScroll ? $rightArrow : $leftArrow;
        stc.$slideRightArrowClickTarget = stc.reverseScroll ? $rightArrowClickTarget : $leftArrowClickTarget;
        stc.$scrollArrows = stc.$slideLeftArrow.add(stc.$slideRightArrow);
  
        stc.$win = $(window);
      };
  
      p.setElementWidths = function () {
        var ehd = this,
            stc = ehd.stc;
  
        stc.winWidth = stc.$win.width();
        stc.scrollArrowsCombinedWidth = stc.$slideLeftArrow.outerWidth() + stc.$slideRightArrow.outerWidth();
  
        ehd.setFixedContainerWidth();
        ehd.setMovableContainerWidth();
      };
  
      p.setEventListeners = function (settings) {
        var ehd = this,
            stc = ehd.stc,
            evh = stc.eventHandlers,
            ev = CONSTANTS.EVENTS,
            resizeEventName = ev.WINDOW_RESIZE + stc.instanceId;
  
        if (settings.enableSwiping) {
          ehd.listenForTouchEvents();
        }
  
        stc.$slideLeftArrowClickTarget
          .off('.scrtabs')
          .on(ev.MOUSEDOWN, function (e) { evh.handleMousedownOnSlideMovContainerLeftArrow.call(evh, e); })
          .on(ev.MOUSEUP, function (e) { evh.handleMouseupOnSlideMovContainerLeftArrow.call(evh, e); })
          .on(ev.CLICK, function (e) { evh.handleClickOnSlideMovContainerLeftArrow.call(evh, e); });
  
        stc.$slideRightArrowClickTarget
          .off('.scrtabs')
          .on(ev.MOUSEDOWN, function (e) { evh.handleMousedownOnSlideMovContainerRightArrow.call(evh, e); })
          .on(ev.MOUSEUP, function (e) { evh.handleMouseupOnSlideMovContainerRightArrow.call(evh, e); })
          .on(ev.CLICK, function (e) { evh.handleClickOnSlideMovContainerRightArrow.call(evh, e); });
  
        if (stc.tabClickHandler) {
          stc.$tabsLiCollection
            .find('a[data-toggle="tab"]')
            .off(ev.CLICK)
            .on(ev.CLICK, stc.tabClickHandler);
        }
  
        if (settings.handleDelayedScrollbar) {
          ehd.listenForDelayedScrollbar();
        }
  
        stc.$win
          .off(resizeEventName)
          .smartresizeScrtabs(function (e) { evh.handleWindowResize.call(evh, e); }, resizeEventName);
  
        $('body').on(CONSTANTS.EVENTS.FORCE_REFRESH, stc.elementsHandler.refreshAllElementSizes.bind(stc.elementsHandler));
      };
  
      p.listenForDelayedScrollbar = function () {
        var iframe = document.createElement('iframe');
        iframe.id = "scrtabs-scrollbar-resize-listener";
        iframe.style.cssText = 'height: 0; background-color: transparent; margin: 0; padding: 0; overflow: hidden; border-width: 0; position: absolute; width: 100%;';
        iframe.onload = function() {
          var timeout;
  
          function handleResize() {
            try {
              $(window).trigger('resize');
              timeout = null;
            } catch(e) {}
          }
  
          iframe.contentWindow.addEventListener('resize', function() {
            if (timeout) {
              clearTimeout(timeout);
            }
  
            timeout = setTimeout(handleResize, 100);
          });
        };
        
        document.body.appendChild(iframe);
      };
  
      p.setFixedContainerWidth = function () {
        var ehd = this,
            stc = ehd.stc,
            tabsContainerRect = stc.$tabsContainer.get(0).getBoundingClientRect();
        /**
         * @author poletaew
         * It solves problem with rounding by jQuery.outerWidth
         * If we have real width 100.5 px, jQuery.outerWidth returns us 101 px and we get layout's fail
         */
        stc.fixedContainerWidth = tabsContainerRect.width || (tabsContainerRect.right - tabsContainerRect.left);
        stc.fixedContainerWidth = stc.fixedContainerWidth * stc.widthMultiplier;
  
        stc.$fixedContainer.width(stc.fixedContainerWidth);
      };
  
      p.setFixedContainerWidthForHiddenScrollArrows = function () {
        var ehd = this,
            stc = ehd.stc;
  
        stc.$fixedContainer.width(stc.fixedContainerWidth);
      };
  
      p.setFixedContainerWidthForVisibleScrollArrows = function () {
        var ehd = this,
            stc = ehd.stc;
  
        stc.$fixedContainer.width(stc.fixedContainerWidth - stc.scrollArrowsCombinedWidth);
      };
  
      p.setMovableContainerWidth = function () {
        var ehd = this,
            stc = ehd.stc,
            $tabLi = stc.$tabsUl.find('> li');
  
        stc.movableContainerWidth = 0;
  
        if ($tabLi.length) {
  
          $tabLi.each(function () {
            var $li = $(this),
                totalMargin = 0;
  
            if (stc.isNavPills) { // pills have a margin-left, tabs have no margin
              totalMargin = parseInt($li.css('margin-left'), 10) + parseInt($li.css('margin-right'), 10);
            }
  
            stc.movableContainerWidth += ($li.outerWidth() + totalMargin);
          });
  
          stc.movableContainerWidth += 1;
  
          // if the tabs don't span the width of the page, force the
          // movable container width to full page width so the bottom
          // border spans the page width instead of just spanning the
          // width of the tabs
          if (stc.movableContainerWidth < stc.fixedContainerWidth) {
            stc.movableContainerWidth = stc.fixedContainerWidth;
          }
        }
  
        stc.$movableContainer.width(stc.movableContainerWidth);
      };
  
      p.setScrollArrowVisibility = function () {
        var ehd = this,
            stc = ehd.stc,
            shouldBeVisible = stc.movableContainerWidth > stc.fixedContainerWidth;
  
        if (shouldBeVisible && !stc.scrollArrowsVisible) {
          stc.$scrollArrows.show();
          stc.scrollArrowsVisible = true;
        } else if (!shouldBeVisible && stc.scrollArrowsVisible) {
          stc.$scrollArrows.hide();
          stc.scrollArrowsVisible = false;
        }
  
        if (stc.scrollArrowsVisible) {
          ehd.setFixedContainerWidthForVisibleScrollArrows();
        } else {
          ehd.setFixedContainerWidthForHiddenScrollArrows();
        }
      };
  
  }(ElementsHandler.prototype));
  
  /* ***********************************************************************************
   * EventHandlers - Class that each instance of ScrollingTabsControl will instantiate
   * **********************************************************************************/
  function EventHandlers(scrollingTabsControl) {
    var evh = this;
  
    evh.stc = scrollingTabsControl;
  }
  
  // prototype methods
  (function (p){
    p.handleClickOnSlideMovContainerLeftArrow = function () {
      var evh = this,
          stc = evh.stc;
  
      stc.scrollMovement.incrementMovableContainerLeft();
    };
  
    p.handleClickOnSlideMovContainerRightArrow = function () {
      var evh = this,
          stc = evh.stc;
  
      stc.scrollMovement.incrementMovableContainerRight();
    };
  
    p.handleMousedownOnSlideMovContainerLeftArrow = function () {
      var evh = this,
          stc = evh.stc;
  
      stc.$slideLeftArrowClickTarget.data(CONSTANTS.DATA_KEY_IS_MOUSEDOWN, true);
      stc.scrollMovement.continueSlideMovableContainerLeft();
    };
  
    p.handleMousedownOnSlideMovContainerRightArrow = function () {
      var evh = this,
          stc = evh.stc;
  
      stc.$slideRightArrowClickTarget.data(CONSTANTS.DATA_KEY_IS_MOUSEDOWN, true);
      stc.scrollMovement.continueSlideMovableContainerRight();
    };
  
    p.handleMouseupOnSlideMovContainerLeftArrow = function () {
      var evh = this,
          stc = evh.stc;
  
      stc.$slideLeftArrowClickTarget.data(CONSTANTS.DATA_KEY_IS_MOUSEDOWN, false);
    };
  
    p.handleMouseupOnSlideMovContainerRightArrow = function () {
      var evh = this,
          stc = evh.stc;
  
      stc.$slideRightArrowClickTarget.data(CONSTANTS.DATA_KEY_IS_MOUSEDOWN, false);
    };
  
    p.handleWindowResize = function () {
      var evh = this,
          stc = evh.stc,
          newWinWidth = stc.$win.width();
  
      if (newWinWidth === stc.winWidth) {
        return false;
      }
  
      stc.winWidth = newWinWidth;
      stc.elementsHandler.refreshAllElementSizes();
    };
  
  }(EventHandlers.prototype));
  
  /* ***********************************************************************************
   * ScrollMovement - Class that each instance of ScrollingTabsControl will instantiate
   * **********************************************************************************/
  function ScrollMovement(scrollingTabsControl) {
    var smv = this;
  
    smv.stc = scrollingTabsControl;
  }
  
  // prototype methods
  (function (p) {
  
    p.continueSlideMovableContainerLeft = function () {
      var smv = this,
          stc = smv.stc;
  
      setTimeout(function() {
        if (stc.movableContainerLeftPos <= smv.getMinPos()  ||
            !stc.$slideLeftArrowClickTarget.data(CONSTANTS.DATA_KEY_IS_MOUSEDOWN)) {
          return;
        }
  
        if (!smv.incrementMovableContainerLeft()) { // haven't reached max left
          smv.continueSlideMovableContainerLeft();
        }
      }, CONSTANTS.CONTINUOUS_SCROLLING_TIMEOUT_INTERVAL);
    };
  
    p.continueSlideMovableContainerRight = function () {
      var smv = this,
          stc = smv.stc;
  
      setTimeout(function() {
        if (stc.movableContainerLeftPos >= 0  ||
            !stc.$slideRightArrowClickTarget.data(CONSTANTS.DATA_KEY_IS_MOUSEDOWN)) {
          return;
        }
  
        if (!smv.incrementMovableContainerRight()) { // haven't reached max right
          smv.continueSlideMovableContainerRight();
        }
      }, CONSTANTS.CONTINUOUS_SCROLLING_TIMEOUT_INTERVAL);
    };
  
    p.decrementMovableContainerLeftPos = function (minPos) {
      var smv = this,
          stc = smv.stc;
  
      stc.movableContainerLeftPos -= (stc.fixedContainerWidth / CONSTANTS.SCROLL_OFFSET_FRACTION);
      if (stc.movableContainerLeftPos < minPos) {
        stc.movableContainerLeftPos = minPos;
      } else if (stc.scrollToTabEdge) {
        smv.setMovableContainerLeftPosToTabEdge(CONSTANTS.SLIDE_DIRECTION.LEFT);
  
        if (stc.movableContainerLeftPos < minPos) {
          stc.movableContainerLeftPos = minPos;
        }
      }
    };
  
    p.disableSlideLeftArrow = function () {
      var smv = this,
          stc = smv.stc;
  
      if (!stc.disableScrollArrowsOnFullyScrolled || !stc.scrollArrowsVisible) {
        return;
      }
  
      stc.$slideLeftArrow.addClass(CONSTANTS.CSS_CLASSES.SCROLL_ARROW_DISABLE);
    };
  
    p.disableSlideRightArrow = function () {
      var smv = this,
          stc = smv.stc;
  
      if (!stc.disableScrollArrowsOnFullyScrolled || !stc.scrollArrowsVisible) {
        return;
      }
  
      stc.$slideRightArrow.addClass(CONSTANTS.CSS_CLASSES.SCROLL_ARROW_DISABLE);
    };
  
    p.enableSlideLeftArrow = function () {
      var smv = this,
          stc = smv.stc;
  
      if (!stc.disableScrollArrowsOnFullyScrolled || !stc.scrollArrowsVisible) {
        return;
      }
  
      stc.$slideLeftArrow.removeClass(CONSTANTS.CSS_CLASSES.SCROLL_ARROW_DISABLE);
    };
  
    p.enableSlideRightArrow = function () {
      var smv = this,
          stc = smv.stc;
  
      if (!stc.disableScrollArrowsOnFullyScrolled || !stc.scrollArrowsVisible) {
        return;
      }
  
      stc.$slideRightArrow.removeClass(CONSTANTS.CSS_CLASSES.SCROLL_ARROW_DISABLE);
    };
  
    p.getMinPos = function () {
      var smv = this,
          stc = smv.stc;
  
      return stc.scrollArrowsVisible ? (stc.fixedContainerWidth - stc.movableContainerWidth - stc.scrollArrowsCombinedWidth) : 0;
    };
  
    p.getMovableContainerCssLeftVal = function () {
      var smv = this,
          stc = smv.stc;
  
      return (stc.movableContainerLeftPos === 0) ? '0' : stc.movableContainerLeftPos + 'px';
    };
  
    p.incrementMovableContainerLeft = function () {
      var smv = this,
          stc = smv.stc,
          minPos = smv.getMinPos();
  
      smv.decrementMovableContainerLeftPos(minPos);
      smv.slideMovableContainerToLeftPos();
      smv.enableSlideRightArrow();
  
      // return true if we're fully left, false otherwise
      return (stc.movableContainerLeftPos === minPos);
    };
  
    p.incrementMovableContainerRight = function (minPos) {
      var smv = this,
          stc = smv.stc;
  
      // if minPos passed in, the movable container was beyond the minPos
      if (minPos) {
        stc.movableContainerLeftPos = minPos;
      } else {
        stc.movableContainerLeftPos += (stc.fixedContainerWidth / CONSTANTS.SCROLL_OFFSET_FRACTION);
  
        if (stc.movableContainerLeftPos > 0) {
          stc.movableContainerLeftPos = 0;
        } else if (stc.scrollToTabEdge) {
          smv.setMovableContainerLeftPosToTabEdge(CONSTANTS.SLIDE_DIRECTION.RIGHT);
        }
      }
  
      smv.slideMovableContainerToLeftPos();
      smv.enableSlideLeftArrow();
  
      // return true if we're fully right, false otherwise
      // left pos of 0 is the movable container's max position (farthest right)
      return (stc.movableContainerLeftPos === 0);
    };
  
    p.refreshScrollArrowsDisabledState = function() {
      var smv = this,
          stc = smv.stc;
  
      if (!stc.disableScrollArrowsOnFullyScrolled || !stc.scrollArrowsVisible) {
        return;
      }
  
      if (stc.movableContainerLeftPos >= 0) { // movable container fully right
        smv.disableSlideRightArrow();
        smv.enableSlideLeftArrow();
        return;
      }
  
      if (stc.movableContainerLeftPos <= smv.getMinPos()) { // fully left
        smv.disableSlideLeftArrow();
        smv.enableSlideRightArrow();
        return;
      }
  
      smv.enableSlideLeftArrow();
      smv.enableSlideRightArrow();
    };
  
    p.scrollToActiveTab = function () {
      var smv = this,
          stc = smv.stc,
          $activeTab,
          $activeTabAnchor,
          activeTabLeftPos,
          activeTabRightPos,
          rightArrowLeftPos,
          activeTabWidth,
          leftPosOffset,
          offsetToMiddle,
          leftScrollArrowWidth,
          rightScrollArrowWidth;
  
      if (!stc.scrollArrowsVisible) {
        return;
      }
  
      $activeTabAnchor = stc.$tabsUl.find('li > .nav-link.active');
      if ($activeTabAnchor.length) {
        $activeTab = $activeTabAnchor.parent();
      }
  
      if (!$activeTab || !$activeTab.length) {
        return;
      }
  
      rightScrollArrowWidth = stc.$slideRightArrow.outerWidth();
      activeTabWidth = $activeTab.outerWidth();
  
      /**
       * @author poletaew
       * We need relative offset (depends on $fixedContainer), don't absolute
       */
      activeTabLeftPos = $activeTab.offset().left - stc.$fixedContainer.offset().left;
      activeTabRightPos = activeTabLeftPos + activeTabWidth;
  
      rightArrowLeftPos = stc.fixedContainerWidth - rightScrollArrowWidth;
  
      if (stc.rtl) {
        leftScrollArrowWidth = stc.$slideLeftArrow.outerWidth();
  
        if (activeTabLeftPos < 0) { // active tab off left side
          stc.movableContainerLeftPos += activeTabLeftPos;
          smv.slideMovableContainerToLeftPos();
          return true;
        } else { // active tab off right side
          if (activeTabRightPos > rightArrowLeftPos) {
            stc.movableContainerLeftPos += (activeTabRightPos - rightArrowLeftPos) + (2 * rightScrollArrowWidth);
            smv.slideMovableContainerToLeftPos();
            return true;
          }
        }
      } else {
        if (activeTabRightPos > rightArrowLeftPos) { // active tab off right side
          leftPosOffset = activeTabRightPos - rightArrowLeftPos + rightScrollArrowWidth;
          offsetToMiddle = stc.fixedContainerWidth / 2;
          leftPosOffset += offsetToMiddle - (activeTabWidth / 2);
          stc.movableContainerLeftPos -= leftPosOffset;
          smv.slideMovableContainerToLeftPos();
          return true;
        } else {
          leftScrollArrowWidth = stc.$slideLeftArrow.outerWidth();
          if (activeTabLeftPos < 0) { // active tab off left side
            offsetToMiddle = stc.fixedContainerWidth / 2;
            stc.movableContainerLeftPos += (-activeTabLeftPos) + offsetToMiddle - (activeTabWidth / 2);
            smv.slideMovableContainerToLeftPos();
            return true;
          }
        }
      }
  
      return false;
    };
  
    p.setMovableContainerLeftPosToTabEdge = function (slideDirection) {
      var smv = this,
          stc = smv.stc,
          offscreenWidth = -stc.movableContainerLeftPos,
          totalTabWidth = 0;
  
        // make sure LeftPos is set so that a tab edge will be against the
        // left scroll arrow so we won't have a partial, cut-off tab
        stc.$tabsLiCollection.each(function () {
          var tabWidth = $(this).width();
  
          totalTabWidth += tabWidth;
  
          if (totalTabWidth > offscreenWidth) {
            stc.movableContainerLeftPos = (slideDirection === CONSTANTS.SLIDE_DIRECTION.RIGHT) ? -(totalTabWidth - tabWidth) : -totalTabWidth;
            return false; // exit .each() loop
          }
  
        });
    };
  
    p.slideMovableContainerToLeftPos = function () {
      var smv = this,
          stc = smv.stc,
          minPos = smv.getMinPos(),
          leftOrRightVal;
  
      if (stc.movableContainerLeftPos > 0) {
        stc.movableContainerLeftPos = 0;
      } else if (stc.movableContainerLeftPos < minPos) {
        stc.movableContainerLeftPos = minPos;
      }
  
      stc.movableContainerLeftPos = stc.movableContainerLeftPos / 1;
      leftOrRightVal = smv.getMovableContainerCssLeftVal();
  
      smv.performingSlideAnim = true;
  
      stc.$movableContainer.css({
        transform: 'translateX(' + leftOrRightVal + ')'
      });
  
      stc.$movableContainer.on('transitionend.scrtabs', function() {
        stc.$movableContainer.off('transitionend.scrtabs');
        smv.performingSlideAnim = false;
        smv.refreshScrollArrowsDisabledState();
      });
    };
  
  }(ScrollMovement.prototype));
  
  /* **********************************************************************
   * ScrollingTabsControl - Class that each directive will instantiate
   * **********************************************************************/
  function ScrollingTabsControl($tabsContainer) {
    var stc = this;
  
    stc.$tabsContainer = $tabsContainer;
    stc.instanceId = $.fn.scrollingTabs.nextInstanceId++;
  
    stc.movableContainerLeftPos = 0;
    stc.scrollArrowsVisible = false;
    stc.scrollToTabEdge = false;
    stc.disableScrollArrowsOnFullyScrolled = false;
    stc.reverseScroll = false;
    stc.widthMultiplier = 1;
  
    stc.scrollMovement = new ScrollMovement(stc);
    stc.eventHandlers = new EventHandlers(stc);
    stc.elementsHandler = new ElementsHandler(stc);
  }
  
  // prototype methods
  (function (p) {
    p.initTabs = function (options, $scroller, readyCallback, attachTabContentToDomCallback) {
      var stc = this,
          elementsHandler = stc.elementsHandler,
          num;
  
      if (options.enableRtlSupport && $('html').attr('dir') === 'rtl') {
        stc.rtl = true;
      }
  
      if (options.scrollToTabEdge) {
        stc.scrollToTabEdge = true;
      }
  
      if (options.disableScrollArrowsOnFullyScrolled) {
        stc.disableScrollArrowsOnFullyScrolled = true;
      }
  
      if (options.reverseScroll) {
        stc.reverseScroll = true;
      }
  
      if (options.widthMultiplier !== 1) {
        num = Number(options.widthMultiplier); // handle string value
  
        if (!isNaN(num)) {
          stc.widthMultiplier = num;
        }
      }
  
      if (options.bootstrapVersion.toString().charAt(0) === '4') {
        stc.usingBootstrap4 = true;
      }
  
      setTimeout(initTabsAfterTimeout, 100);
  
      function initTabsAfterTimeout() {
        var actionsTaken;
  
        // if we're just wrapping non-data-driven tabs, the user might
        // have the .nav-tabs hidden to prevent the clunky flash of
        // multi-line tabs on page refresh, so we need to make sure
        // they're visible before trying to wrap them
        $scroller.find('.nav-tabs').show();
  
        elementsHandler.initElements(options);
        actionsTaken = elementsHandler.refreshAllElementSizes();
  
        $scroller.css('visibility', 'visible');
  
        if (attachTabContentToDomCallback) {
          attachTabContentToDomCallback();
        }
  
        if (readyCallback) {
          readyCallback();
        }
      }
    };
  
    p.scrollToActiveTab = function(options) {
      var stc = this,
          smv = stc.scrollMovement;
  
      smv.scrollToActiveTab(options);
    };
  }(ScrollingTabsControl.prototype));
  

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
  
  /* exported listenForDropdownMenuTabs,
              refreshTargetElementInstance,
              scrollToActiveTab */
  function checkForTabAdded(refreshData) {
    var updatedTabsArray = refreshData.updatedTabsArray,
        updatedTabsLiContent = refreshData.updatedTabsLiContent || [],
        updatedTabsPostProcessors = refreshData.updatedTabsPostProcessors || [],
        propNames = refreshData.propNames,
        ignoreTabPanes = refreshData.ignoreTabPanes,
        options = refreshData.options,
        $currTabLis = refreshData.$currTabLis,
        $navTabs = refreshData.$navTabs,
        $currTabContentPanesContainer = ignoreTabPanes ? null : refreshData.$currTabContentPanesContainer,
        $currTabContentPanes = ignoreTabPanes ? null : refreshData.$currTabContentPanes,
        isInitTabsRequired = false;
  
    // make sure each tab in the updated tabs array has a corresponding DOM element
    updatedTabsArray.forEach(function (tab, idx) {
      var $li = $currTabLis.find('a[href="#' + tab[propNames.paneId] + '"]'),
          isTabIdxPastCurrTabs = (idx >= $currTabLis.length),
          $pane;
  
      if (!$li.length) { // new tab
        isInitTabsRequired = true;
  
        // add the tab, add its pane (if necessary), and refresh the scroller
        options.tabLiContent = updatedTabsLiContent[idx];
        options.tabPostProcessor = updatedTabsPostProcessors[idx];
        $li = tabElements.getNewElTabLi(tab, propNames, options);
        tabUtils.storeDataOnLiEl($li, updatedTabsArray, idx);
  
        if (isTabIdxPastCurrTabs) { // append to end of current tabs
          $li.appendTo($navTabs);
        } else {                        // insert in middle of current tabs
          $li.insertBefore($currTabLis.eq(idx));
        }
  
        if (!ignoreTabPanes && tab[propNames.content] !== undefined) {
          $pane = tabElements.getNewElTabPane(tab, propNames, options);
          if (isTabIdxPastCurrTabs) { // append to end of current tabs
            $pane.appendTo($currTabContentPanesContainer);
          } else {                        // insert in middle of current tabs
            $pane.insertBefore($currTabContentPanes.eq(idx));
          }
        }
  
      }
  
    });
  
    return isInitTabsRequired;
  }
  
  function getTabAnchor($li) {
    return $li.find('a[role="tab"]');
  }
  
  function checkForTabPropertiesUpdated(refreshData) {
    var tabLiData = refreshData.tabLi,
        ignoreTabPanes = refreshData.ignoreTabPanes,
        $li = tabLiData.$li,
        $contentPane = tabLiData.$contentPane,
        origTabData = tabLiData.origTabData,
        newTabData = tabLiData.newTabData,
        propNames = refreshData.propNames,
        isInitTabsRequired = false;
  
    // update tab title if necessary
    if (origTabData[propNames.title] !== newTabData[propNames.title]) {
      getTabAnchor($li).html(origTabData[propNames.title] = newTabData[propNames.title]);
      isInitTabsRequired = true;
    }
  
    // update tab disabled state if necessary
    if (origTabData[propNames.disabled] !== newTabData[propNames.disabled]) {
      if (newTabData[propNames.disabled]) { // enabled -> disabled
        getTabAnchor($li).addClass('disabled').attr('data-toggle', '');
      } else { // disabled -> enabled
        getTabAnchor($li).removeClass('disabled').attr('data-toggle', 'tab');
      }
  
      origTabData[propNames.disabled] = newTabData[propNames.disabled];
      isInitTabsRequired = true;
    }
  
    // update tab active state if necessary
    if (refreshData.options.forceActiveTab) {
      // set the active tab based on the tabs array regardless of the current
      // DOM state, which could have been changed by the user clicking a tab
      // without those changes being reflected back to the tab data
      getTabAnchor($li)[newTabData[propNames.active] ? 'addClass' : 'removeClass']('active');
  
      $contentPane[newTabData[propNames.active] ? 'addClass' : 'removeClass']('active');
  
      origTabData[propNames.active] = newTabData[propNames.active];
  
      isInitTabsRequired = true;
    }
  
    // update tab content pane if necessary
    if (!ignoreTabPanes && origTabData[propNames.content] !== newTabData[propNames.content]) {
      $contentPane.html(origTabData[propNames.content] = newTabData[propNames.content]);
      isInitTabsRequired = true;
    }
  
    return isInitTabsRequired;
  }
  
  function checkForTabRemoved(refreshData) {
    var tabLiData = refreshData.tabLi,
        ignoreTabPanes = refreshData.ignoreTabPanes,
        $li = tabLiData.$li,
        idxToMakeActive;
  
    if (tabLiData.newIdx !== -1) { // tab was not removed--it has a valid index
      return false;
    }
  
    // if this was the active tab, make the closest enabled tab active
    if (getTabAnchor($li).hasClass('active')) {
  
      idxToMakeActive = tabUtils.getIndexOfClosestEnabledTab(refreshData.$currTabLis, tabLiData.currDomIdx);
      if (idxToMakeActive > -1) {
        refreshData.$currTabLis
          .eq(idxToMakeActive)
          .find('a[role="tab"]')
          .addClass('active');
  
        if (!ignoreTabPanes) {
          refreshData.$currTabContentPanes
            .eq(idxToMakeActive)
            .find('a[role="tab"]')
            .addClass('active');
        }
      }
    }
  
    $li.remove();
  
    if (!ignoreTabPanes) {
      tabLiData.$contentPane.remove();
    }
  
    return true;
  }
  
  function checkForTabsOrderChanged(refreshData) {
    var $currTabLis = refreshData.$currTabLis,
        updatedTabsArray = refreshData.updatedTabsArray,
        propNames = refreshData.propNames,
        ignoreTabPanes = refreshData.ignoreTabPanes,
        newTabsCollection = [],
        newTabPanesCollection = ignoreTabPanes ? null : [];
  
    if (!tabUtils.didTabOrderChange($currTabLis, updatedTabsArray, propNames)) {
      return false;
    }
  
    // the tab order changed...
    updatedTabsArray.forEach(function (t) {
      var paneId = t[propNames.paneId];
  
      newTabsCollection.push(
          $currTabLis
            .find('a[role="tab"][href="#' + paneId + '"]')
            .parent('li')
          );
  
      if (!ignoreTabPanes) {
        newTabPanesCollection.push($('#' + paneId));
      }
    });
  
    refreshData.$navTabs.append(newTabsCollection);
  
    if (!ignoreTabPanes) {
      refreshData.$currTabContentPanesContainer.append(newTabPanesCollection);
    }
  
    return true;
  }
  
  function checkForTabsRemovedOrUpdated(refreshData) {
    var $currTabLis = refreshData.$currTabLis,
        updatedTabsArray = refreshData.updatedTabsArray,
        propNames = refreshData.propNames,
        isInitTabsRequired = false;
  
  
    $currTabLis.each(function (currDomIdx) {
      var $li = $(this),
          origTabData = $li.data('tab'),
          newIdx = tabUtils.getTabIndexByPaneId(updatedTabsArray, propNames.paneId, origTabData[propNames.paneId]),
          newTabData = (newIdx > -1) ? updatedTabsArray[newIdx] : null;
  
      refreshData.tabLi = {
        $li: $li,
        currDomIdx: currDomIdx,
        newIdx: newIdx,
        $contentPane: tabElements.getElTabPaneForLi($li),
        origTabData: origTabData,
        newTabData: newTabData
      };
  
      if (checkForTabRemoved(refreshData)) {
        isInitTabsRequired = true;
        return; // continue to next $li in .each() since we removed this tab
      }
  
      if (checkForTabPropertiesUpdated(refreshData)) {
        isInitTabsRequired = true;
      }
    });
  
    return isInitTabsRequired;
  }
  
  function listenForDropdownMenuTabs($scroller, stc) {
    var $ddMenu;
  
    // for dropdown menus to show, we need to move them out of the
    // scroller and append them to the body
    $scroller
      .on(CONSTANTS.EVENTS.DROPDOWN_MENU_SHOW, handleDropdownShow)
      .on(CONSTANTS.EVENTS.DROPDOWN_MENU_HIDE, handleDropdownHide);
  
    function handleDropdownHide(e) {
      // move the dropdown menu back into its tab
      $(e.target).append($ddMenu.off(CONSTANTS.EVENTS.CLICK));
    }
  
    function handleDropdownShow(e) {
      var $ddParentTabLi = $(e.target),
          ddLiOffset = $ddParentTabLi.offset(),
          $currActiveTab = $scroller.find('li.nav-item > a.active').parent(),
          ddMenuRightX,
          tabsContainerMaxX,
          ddMenuTargetLeft;
  
      $ddMenu = $ddParentTabLi
                  .find('.dropdown-menu')
                  .attr('data-' + CONSTANTS.DATA_KEY_DDMENU_MODIFIED, true);
  
      // if the dropdown's parent tab li isn't already active,
      // we need to deactivate any active menu item in the dropdown
      if ($currActiveTab[0] !== $ddParentTabLi[0]) {
        $ddMenu.find('a.nav-link.active').removeClass('active');
      }
  
      // we need to do our own click handling because the built-in
      // bootstrap handlers won't work since we moved the dropdown
      // menu outside the tabs container
      $ddMenu.on(CONSTANTS.EVENTS.CLICK, 'a[role="tab"]', handleClickOnDropdownMenuItem);
  
      $('body').append($ddMenu);
  
      // make sure the menu doesn't go off the right side of the page
      ddMenuRightX = $ddMenu.width() + ddLiOffset.left;
      tabsContainerMaxX = $scroller.width() - (stc.$slideRightArrow.outerWidth() + 1);
      ddMenuTargetLeft = ddLiOffset.left;
  
      if (ddMenuRightX > tabsContainerMaxX) {
        ddMenuTargetLeft -= (ddMenuRightX - tabsContainerMaxX);
      }
  
      $ddMenu.css({
        'display': 'block',
        'top': ddLiOffset.top + $ddParentTabLi.outerHeight() - 2,
        'left': ddMenuTargetLeft
      });
  
      function handleClickOnDropdownMenuItem(e) {
        /* jshint validthis: true */
        var $selectedMenuItemAnc = $(e.target),
            $selectedMenuItemDropdownMenu = $selectedMenuItemAnc.parent('.dropdown-menu'),
            targetPaneId = $selectedMenuItemAnc.attr('href');
  
        if ($selectedMenuItemAnc.find('a').hasClass('active')) {
          return;
        }
  
        // once we select a menu item from the dropdown, deactivate
        // the current tab (unless it's our parent tab), deactivate
        // any active dropdown menu item, make our parent tab active
        // (if it's not already), and activate the selected menu item
        $scroller
          .find('li > a.active')
          .not($ddParentTabLi.find('> a.nav-link'))
          .add($selectedMenuItemDropdownMenu.find('li > a.nav-link.active'))
          .removeClass('active');
  
        $ddParentTabLi.find('> a.nav-link').addClass('active');
  
        // manually deactivate current active pane and activate our pane
        $('.tab-content .tab-pane.active').removeClass('active');
        $(targetPaneId).addClass('active show');
      }
  
    }
  }
  
  function refreshDataDrivenTabs($container, options) {
    var instanceData = $container.data().scrtabs,
        scroller = instanceData.scroller,
        $navTabs = $container.find('.scrtabs-tab-container .nav-tabs'),
        $currTabContentPanesContainer = $container.find('.tab-content'),
        isInitTabsRequired = false,
        refreshData = {
          options: options,
          updatedTabsArray: instanceData.tabs,
          updatedTabsLiContent: instanceData.tabsLiContent,
          updatedTabsPostProcessors: instanceData.tabsPostProcessors,
          propNames: instanceData.propNames,
          ignoreTabPanes: instanceData.ignoreTabPanes,
          $navTabs: $navTabs,
          $currTabLis: $navTabs.find('> li'),
          $currTabContentPanesContainer: $currTabContentPanesContainer,
          $currTabContentPanes: $currTabContentPanesContainer.find('.tab-pane')
        };
  
    // to preserve the tab positions if we're just adding or removing
    // a tab, don't completely rebuild the tab structure, but check
    // for differences between the new tabs array and the old
    if (checkForTabAdded(refreshData)) {
      isInitTabsRequired = true;
    }
  
    if (checkForTabsOrderChanged(refreshData)) {
      isInitTabsRequired = true;
    }
  
    if (checkForTabsRemovedOrUpdated(refreshData)) {
      isInitTabsRequired = true;
    }
  
    if (isInitTabsRequired) {
      scroller.initTabs();
    }
  
    return isInitTabsRequired;
  }
  
  function refreshTargetElementInstance($container, options) {
    if (!$container.data('scrtabs')) { // target element doesn't have plugin on it
      return;
    }
  
    // force a refresh if the tabs are static html or they're data-driven
    // but the data didn't change so we didn't call initTabs()
    if ($container.data('scrtabs').isWrapperOnly || !refreshDataDrivenTabs($container, options)) {
      $('body').trigger(CONSTANTS.EVENTS.FORCE_REFRESH);
    }
  }
  
  function scrollToActiveTab() {
    /* jshint validthis: true */
    var $targetElInstance = $(this),
        scrtabsData = $targetElInstance.data('scrtabs');
  
    if (!scrtabsData) {
      return;
    }
  
    scrtabsData.scroller.scrollToActiveTab();
  }
  
  var methods = {
    destroy: function() {
      var $targetEls = this;
  
      return $targetEls.each(destroyPlugin);
    },
  
    init: function(options) {
      var $targetEls = this,
          targetElsLastIndex = $targetEls.length - 1,
          settings = $.extend({}, $.fn.scrollingTabs.defaults, options || {});
  
      // ---- tabs NOT data-driven -------------------------
      if (!settings.tabs) {
  
        // just wrap the selected .nav-tabs element(s) in the scroller
        return $targetEls.each(function(index) {
          var dataObj = {
                isWrapperOnly: true
              },
              $targetEl = $(this).data({ scrtabs: dataObj }),
              readyCallback = (index < targetElsLastIndex) ? null : function() {
                $targetEls.trigger(CONSTANTS.EVENTS.TABS_READY);
              };
  
          wrapNavTabsInstanceInScroller($targetEl, settings, readyCallback);
        });
  
      }
  
      // ---- tabs data-driven -------------------------
      return $targetEls.each(function (index) {
        var $targetEl = $(this),
            readyCallback = (index < targetElsLastIndex) ? null : function() {
              $targetEls.trigger(CONSTANTS.EVENTS.TABS_READY);
            };
  
        buildNavTabsAndTabContentForTargetElementInstance($targetEl, settings, readyCallback);
      });
    },
  
    refresh: function(options) {
      var $targetEls = this,
          settings = $.extend({}, $.fn.scrollingTabs.defaults, options || {});
  
      return $targetEls.each(function () {
        refreshTargetElementInstance($(this), settings);
      });
    },
  
    scrollToActiveTab: function() {
      return this.each(scrollToActiveTab);
    }
  };
  
  function destroyPlugin() {
    /* jshint validthis: true */
    var $targetElInstance = $(this),
        scrtabsData = $targetElInstance.data('scrtabs'),
        $tabsContainer;
  
    if (!scrtabsData) {
      return;
    }
  
    if (scrtabsData.enableSwipingElement === 'self') {
      $targetElInstance.removeClass(CONSTANTS.CSS_CLASSES.ALLOW_SCROLLBAR);
    } else if (scrtabsData.enableSwipingElement === 'parent') {
      $targetElInstance.closest('.scrtabs-tab-container').parent().removeClass(CONSTANTS.CSS_CLASSES.ALLOW_SCROLLBAR);
    }
  
    scrtabsData.scroller
      .off(CONSTANTS.EVENTS.DROPDOWN_MENU_SHOW)
      .off(CONSTANTS.EVENTS.DROPDOWN_MENU_HIDE);
  
    // if there were any dropdown menus opened, remove the css we added to
    // them so they would display correctly
    scrtabsData.scroller
      .find('[data-' + CONSTANTS.DATA_KEY_DDMENU_MODIFIED + ']')
      .css({
        display: '',
        left: '',
        top: ''
      })
      .off(CONSTANTS.EVENTS.CLICK)
      .removeAttr('data-' + CONSTANTS.DATA_KEY_DDMENU_MODIFIED);
  
    if (scrtabsData.scroller.hasTabClickHandler) {
      $targetElInstance
        .find('a[data-toggle="tab"]')
        .off('.scrtabs');
    }
  
    if (scrtabsData.isWrapperOnly) { // we just wrapped nav-tabs markup, so restore it
      // $targetElInstance is the ul.nav-tabs
      $tabsContainer = $targetElInstance.parents('.scrtabs-tab-container');
  
      if ($tabsContainer.length) {
        $tabsContainer.replaceWith($targetElInstance);
      }
  
    } else { // we generated the tabs from data so destroy everything we created
      if (scrtabsData.scroller && scrtabsData.scroller.initTabs) {
        scrtabsData.scroller.initTabs = null;
      }
  
      // $targetElInstance is the container for the ul.nav-tabs we generated
      $targetElInstance
        .find('.scrtabs-tab-container')
        .add('.tab-content')
        .remove();
    }
  
    $targetElInstance.removeData('scrtabs');
  
    while(--$.fn.scrollingTabs.nextInstanceId >= 0) {
      $(window).off(CONSTANTS.EVENTS.WINDOW_RESIZE + $.fn.scrollingTabs.nextInstanceId);
    }
  
    $('body').off(CONSTANTS.EVENTS.FORCE_REFRESH);
  }
  
  
  $.fn.scrollingTabs = function(methodOrOptions) {
  
    if (methods[methodOrOptions]) {
      return methods[methodOrOptions].apply(this, Array.prototype.slice.call(arguments, 1));
    } else if (!methodOrOptions || (typeof methodOrOptions === 'object')) {
      return methods.init.apply(this, arguments);
    } else {
      $.error('Method ' + methodOrOptions + ' does not exist on $.scrollingTabs.');
    }
  };
  
  $.fn.scrollingTabs.nextInstanceId = 0;
  
  $.fn.scrollingTabs.defaults = {
    tabs: null,
    propPaneId: 'paneId',
    propTitle: 'title',
    propActive: 'active',
    propDisabled: 'disabled',
    propContent: 'content',
    ignoreTabPanes: false,
    scrollToTabEdge: false,
    disableScrollArrowsOnFullyScrolled: false,
    forceActiveTab: false,
    reverseScroll: false,
    widthMultiplier: 1,
    tabClickHandler: null,
    cssClassLeftArrow: '',
    cssClassRightArrow: '',
    leftArrowContent: '',
    rightArrowContent: '',
    tabsLiContent: null,
    tabsPostProcessors: null,
    enableSwiping: false,
    enableRtlSupport: false,
    handleDelayedScrollbar: false,
    bootstrapVersion: 3
  };
  


}(jQuery, window));
