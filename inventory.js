/**
 * @file
 * Attaches behaviors for the Inventory module.
 */

(function ($) {

/**
 * Implements Drupal.behaviors for the Dashboard module.
 */
Drupal.behaviors.inventory = {
  attach: function (context, settings) {
    $('#inventory', context).once(function () {
      $(this).prepend('<div class="customize clearfix"><ul class="action-links"><li><a href="#">' + Drupal.t('Customize inventory') + '</a></li></ul><div class="canvas"></div></div>');
      $('.customize .action-links a', this).click(Drupal.behaviors.inventory.enterCustomizeMode);
    });
    Drupal.behaviors.inventory.addPlaceholders();
    if (Drupal.settings.inventory.launchCustomize) {
      Drupal.behaviors.inventory.enterCustomizeMode();
    }
  },

  addPlaceholders: function() {
    $('#inventory .inventory-region .region').each(function () {
      var empty_text = "";
      // If the region is empty
      if ($('.block', this).length == 0) {
        // Check if we are in customize mode and grab the correct empty text
        if ($('#inventory').hasClass('customize-mode')) {
          empty_text = Drupal.settings.inventory.emptyRegionTextActive;
        } else {
          empty_text = Drupal.settings.inventory.emptyRegionTextInactive;
        }
        // We need a placeholder.
        if ($('.inventory-placeholder', this).length == 0) {
          $(this).append('<div class="inventory-placeholder"></div>');
        }
        $('.inventory-placeholder', this).html(empty_text);
      }
      else {
        $('.inventory-placeholder', this).remove();
      }
    });
  },

  /**
   * Enters "customize" mode by displaying disabled blocks.
   */
  enterCustomizeMode: function () {
    $('#inventory').addClass('customize-mode customize-inactive');
    Drupal.behaviors.inventory.addPlaceholders();
    // Hide the customize link
    $('#inventory .customize .action-links').hide();
    // Load up the disabled blocks
    $('div.customize .canvas').load(Drupal.settings.inventory.drawer, Drupal.behaviors.inventory.setupDrawer);
  },

  /**
   * Exits "customize" mode by simply forcing a page refresh.
   */
  exitCustomizeMode: function () {
    $('#inventory').removeClass('customize-mode customize-inactive');
    Drupal.behaviors.inventory.addPlaceholders();
    location.href = Drupal.settings.inventory.inventory;
  },

  /**
   * Sets up the drag-and-drop behavior and the 'close' button.
   */
  setupDrawer: function () {
    $('div.customize .canvas-content input').click(Drupal.behaviors.inventory.exitCustomizeMode);
    $('div.customize .canvas-content').append('<a class="button" href="' + Drupal.settings.inventory.inventory + '">' + Drupal.t('Done') + '</a>');

    // Initialize drag-and-drop.
    var regions = $('#inventory div.region');
    regions.sortable({
      connectWith: regions,
      cursor: 'move',
      cursorAt: {top:0},
      dropOnEmpty: true,
      items: '> div.block, > div.disabled-block',
      placeholder: 'block-placeholder clearfix',
      tolerance: 'pointer',
      start: Drupal.behaviors.inventory.start,
      over: Drupal.behaviors.inventory.over,
      sort: Drupal.behaviors.inventory.sort,
      update: Drupal.behaviors.inventory.update
    });
  },

  /**
   * Makes the block appear as a disabled block while dragging.
   *
   * This function is called on the jQuery UI Sortable "start" event.
   *
   * @param event
   *  The event that triggered this callback.
   * @param ui
   *  An object containing information about the item that is being dragged.
   */
  start: function (event, ui) {
    $('#inventory').removeClass('customize-inactive');
    var item = $(ui.item);

    // If the block is already in disabled state, don't do anything.
    if (!item.hasClass('disabled-block')) {
      item.css({height: 'auto'});
    }
  },

  /**
   * Adapts block's width to the region it is moved into while dragging.
   *
   * This function is called on the jQuery UI Sortable "over" event.
   *
   * @param event
   *  The event that triggered this callback.
   * @param ui
   *  An object containing information about the item that is being dragged.
   */
  over: function (event, ui) {
    var item = $(ui.item);

    // If the block is in disabled state, remove width.
    if ($(this).closest('#disabled-blocks').length) {
      item.css('width', '');
    }
    else {
      item.css('width', $(this).width());
    }
  },

  /**
   * Adapts a block's position to stay connected with the mouse pointer.
   *
   * This function is called on the jQuery UI Sortable "sort" event.
   *
   * @param event
   *  The event that triggered this callback.
   * @param ui
   *  An object containing information about the item that is being dragged.
   */
  sort: function (event, ui) {
    var item = $(ui.item);

    if (event.pageX > ui.offset.left + item.width()) {
      item.css('left', event.pageX);
    }
  },

  /**
   * Sends block order to the server, and expand previously disabled blocks.
   *
   * This function is called on the jQuery UI Sortable "update" event.
   *
   * @param event
   *   The event that triggered this callback.
   * @param ui
   *   An object containing information about the item that was just dropped.
   */
  update: function (event, ui) {
    $('#inventory').addClass('customize-inactive');
    var item = $(ui.item);

    // If the user dragged a disabled block, load the block contents.
    if (item.hasClass('disabled-block')) {
      var module, delta, itemClass;
      itemClass = item.attr('class');
      // Determine the block module and delta.
      module = itemClass.match(/\bmodule-(\S+)\b/)[1];
      delta = itemClass.match(/\bdelta-(\S+)\b/)[1];

      // Load the newly enabled block's content.
      $.get(Drupal.settings.inventory.blockContent + '/' + module + '/' + delta, {},
        function (block) {
          if (block) {
            item.html(block);
          }

          if (item.find('div.content').is(':empty')) {
            item.find('div.content').html(Drupal.settings.inventory.emptyBlockText);
          }

          Drupal.attachBehaviors(item);
        },
        'html'
      );
      // Remove the "disabled-block" class, so we don't reload its content the
      // next time it's dragged.
      item.removeClass("disabled-block");
    }

    Drupal.behaviors.inventory.addPlaceholders();

    // Let the server know what the new block order is.
    $.post(Drupal.settings.inventory.updatePath, {
        'form_token': Drupal.settings.inventory.formToken,
        'regions': Drupal.behaviors.inventory.getOrder
      }
    );
  },

  /**
   * Returns the current order of the blocks in each of the sortable regions.
   *
   * @return
   *   The current order of the blocks, in query string format.
   */
  getOrder: function () {
    var order = [];
    $('#inventory div.region').each(function () {
      var region = $(this).parent().attr('id').replace(/-/g, '_');
      var blocks = $(this).sortable('toArray');
      $.each(blocks, function() {
        order.push(region + '[]=' + this);
      });
    });
    order = order.join('&');
    return order;
  }
};

})(jQuery);

