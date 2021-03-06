/*global console, alert, jasmine*/

function Kanbanise() {}

Kanbanise.prototype.templateTicket = '<li id="issue-${id}" class="card ticket ${nature_class} ${severity} ${family}">\n'
               + '  <a class="icon" title="${nature_human}"/>\n'
               + '  <span class="story-points">${storyPoints}</span>\n'
               + '  <h4><a href="${redmineroot}issues/${id}">${subject}</a></h4>\n'
               + '  <span class="issue-id">#${id}</span>\n'
               + '  <span class="assigned-to">${assignedTo}</span>\n'
               + '</li style="clear: both;">\n';

Kanbanise.prototype.templateCol = '<div class="list columnWrapper">\n'
               + '  <div id="${id}" class="column">\n'
               + '    <h1>${title}</h1>\n'
               + '    <ul class="sortable">${cards}</ul>\n'
               + '  </div>\n'
               + '</div>\n';

/**
 * Log a message to the console
 * @param {String} msg Something to log
 */
Kanbanise.log = function(msg)  {
    if(window.console && window.console.log) {
        window.console.log(msg);
    }
};

/**
 * @param {Array} data The data to stick into the template
 */ 
Kanbanise.prototype.applyTemplateTicket = function(data) {
    var tmp = '';

    for(var i = 0; i < data.length; i++) {
        // The ${placeholders} need the space and concatenation otherwise the bookmarklet
        // creator collapses them
        tmp += this.templateTicket.replace(/\$\{id\}/gi, data[i].id)
                 .replace('${redmineroot}', this._getRedmineRoot() )
                 .replace('${subject}', data[i].subject)
                 .replace('${storyPoints}', data[i].storyPoints)
                 .replace('${assignedTo}', data[i].assignedTo)
                 .replace('${nature_class}', ' ' + data[i].nature.css + ' ')
                 .replace('${nature_human}', ' ' + data[i].nature.human + ' ')
                 .replace('${severity}', ' ' + data[i].severity + ' ')
                 .replace('${family}', ' ' + data[i].family + ' ');
    }

    return tmp;
};

/**
 * @param {Array} data The data to stick into the template
 */ 
Kanbanise.prototype.applyTemplateCol = function(title, id, cards, columnsize) {
    if ( columnsize == 'normal') {
        return jQuery(this.templateCol.replace('${redmineroot}', this._getRedmineRoot()).replace('${title}', title).replace('${id}', id).replace('${cards}', cards));
    } else {
        return jQuery(this.templateCol.replace('${redmineroot}', this._getRedmineRoot()).replace('${title}', title).replace('${id}', id).replace('${cards}', cards));
    }
};

Kanbanise.prototype.init = function() {
    "use strict";

    var msgWin = null;
    var self = this;
    var $ = jQuery;
    var VERSION = '0.13';
    var API_KEY = null;
    // note: redmineRoot will not work if it's installed anywhere other than /, so
    // foo.com/redmine will not work
    var pathArray = window.location.pathname.split( '/' );
    var subUri = pathArray[1];
    var redmineRoot = window.location.protocol + "//" + window.location.host + "/" +  subUri + "/";

    Kanbanise.log("Kanbanise-Chiliproject URI: " + redmineRoot);
    if($('body.action-index') == null || $('body.action-index').length === 0) {
        alert("This page doesn't look like a Redmine issues list! Please find some issues");
        return;
    }

    this._getRedmineRoot = function() { return redmineRoot; }
    
    function showMessage(msg) {
        if(msgWin === null) {
            $('#msgWin').remove();
            msgWin = $('<div id="msgWin" style=""></div>');
            $('body').append(msgWin);
        }
        $(msgWin).text(msg).show();
    }

    /**
     * The boards on the Kanban board should resize to fit content,
     * then all resize to the height of the tallest board, to make it
     * easy to drag/drop into them
     */
    function resizeColumns() {
        var maxH = 0;
        for(var i = 1; i <= 5; i++) {
            $('#col' + i).height('auto');
            if($('#col' + i).height() > maxH) {
                maxH = $('#col' + i).height();
            }
        }
        $('.sortable').height(maxH);
    }

    /**
     * Set up the board so it is sortable, draggable, droppable
     */
    function setUpSorting() {
        $('.sortable').sortable({
            placeholder: "card ticket placeholder",
            revert: 99, // 99ms
            receive: function(event, ui) {
                resizeColumns();
                var newStatus = $(ui.item).parent().parent().find('h1').text();
                var newStatusId = 1;
                switch(newStatus.toLowerCase()) {
                    case "backlog":
                        newStatusId = 1; break;
                    case "todo":
                        newStatusId = 7; break;
                    case "in progress":
                        newStatusId = 2; break;
                    case "integration":
                        newStatusId = 8; break;
                    case "resolved":
                        newStatusId = 3; break;
                    case "done":
                        newStatusId = 5; break;
                    default:
                        return; // no action if unrecognised
                }

                if (API_KEY === null) {
                    alert("No API key was set. Are you definitely logged in?");
                }

                var issueId = ui.item[0].id.replace('issue-', '');
                // only works if status codes are defaults that come with redmine! No funny business!
                showMessage("Saving changes...");
                jQuery.ajax(redmineRoot + 'issues/' + issueId + '.json', {
                    headers: {
                        'X-ChiliProject-API-Key': API_KEY,
                        'Content-Type': 'application/json'
                    },
                    processData: false,
                    dataType: 'json',
                    data: JSON.stringify({issue:{status_id: newStatusId}}),
                    type: 'PUT',
                    complete: function(jqHXR, textStatus) {
                        $(msgWin).fadeOut('slow');
                    }
                });
            },
            connectWith: '.sortable'
        }).disableSelection();
    }

    /**
     * Make a request to the account page and extract the API access key
     * User has to be logged in for this to work
     */
    function loadApiKey(issues) {
        showMessage("Loading API key...");
        jQuery.ajax(redmineRoot + 'my/account', {complete: function(jqHRX, text) {
            var responseText = jqHRX.responseText;
            var start = responseText.indexOf("id='api-access-key'");
            var hunk = responseText.substring(start, start+100);
            var startKey = hunk.indexOf('>') + 1;
            API_KEY = hunk.substring(startKey, startKey + 40);

            setUpSorting();
            $("<style type='text/css'>.sortable li {cursor:move;}</style>").appendTo("head");
            showMessage("Loaded API key");

            $(msgWin).delay(3000).fadeOut('slow');
        }});
    }

    /**
     * Scrape a screenful of issues in Redmine
     */
    function getIssues() {
        var issues = {
            'backlog': [],
            'todo': [],
            'inProgress': [],
            'integration': [],
            'resolved': [],
            'done': []
        };

        var rows = $('table.issues tr.issue');
        rows.each(function(index, value) {
            var category = 'backlog';

            switch(jQuery(value).children('.status')[0].innerHTML) {
                case 'Rejected':
		case 'Closed':
                    category = 'done';
                    break;
                case 'Todo':
                    category = 'todo';
                    break;
                case 'In Progress':
                    category = 'inProgress';
                    break;
                case 'Resolved':
                case 'Ready for QA':
                    category = 'resolved';
                    break;
                case 'Integration':
                    category = 'integration';
                    break;
                case '':
                    break;
            }

            var storyPoints = '';
            var assignedTo = '';
            var nature_class = '';
            var nature_human = '';
            var family = '';
            var severity = '';

            if( jQuery(value).children('.estimated_hours').length > 0) {
                storyPoints = jQuery(value).children('.estimated_hours')[0].textContent;
                if(storyPoints && storyPoints.length > 0) {
                    storyPoints = storyPoints + " hours";
                }
            }

            if( jQuery(value).children('.assigned_to').length > 0) {
                assignedTo = jQuery(value).children('.assigned_to')[0].textContent;
                if(assignedTo && assignedTo.length > 0) {
                    assignedTo = "Assigned to " + assignedTo;
                }
            }

            if( jQuery(value).children('.tracker').length > 0) {
                var tracker = jQuery(value).children('.tracker')[0].textContent;
                if(tracker && tracker.length > 0) {
                    nature_class = "nature-" + tracker.replace(" ", "-").toLowerCase();
                    nature_human = "This ticket is a " + tracker;
                }
            }

            if( jQuery(value).children('.cf_1').length > 0) {
                severity = jQuery(value).children('.cf_1')[0].textContent;
                if(severity && severity.length > 0) {
                    severity = "severity-" + severity.toLowerCase();
                }
            }

            if( jQuery(value).children('.parent').length > 0) {
                family = jQuery(value).children('.parent')[0].textContent;
                if(family && family.length > 0) {
                   family = "children";
                } else {
                   family = "parent"; 
                }
            }

            issues[category].push({
                'id': jQuery(value).children('.id')[0].textContent,
                'priority': jQuery(value).children('.priority')[0].textContent,
                'subject': jQuery(value).children('.subject')[0].textContent,
                'assignedTo': assignedTo,
                'storyPoints': storyPoints,
                'nature': {
                   'css': nature_class,
                   'human': nature_human
                },
                'severity': severity,
                'family': family
            });
        });
        return issues;
    }

    /**
     * Draw a Kanban-style board on screen
     */
    function createBoard() {
        $('div#kanban').remove();
        var div = $('<div id="kanban"></div>');
        return div;
    }

    function drawBoard(issues) {
        var div = $('div#kanban');

        var today = new Date();
        var todayMonth = today.getMonth() + 1; var todayDate = today.getDate();
        var todayYear = today.getFullYear(); 
        var hours = today.getHours();
        var minutes = today.getMinutes();

        if ((todayMonth+1) < 10) {
            todayMonth = "0"+todayMonth;
        }
        if (todayDate < 10) {
            todayDate = "0"+todayDate;
        }


        if (minutes < 10) { minutes = "0" + minutes; }

        var dateTimeFormated = todayYear + "." + todayMonth + "." + todayDate + " " + hours + ":" + minutes;

        $(div).append('<h3>Kanban-board on ' + dateTimeFormated);

        var col1Content = self.applyTemplateTicket(issues['backlog']);
        var col2Content = self.applyTemplateTicket(issues['todo']);
        var col3Content = self.applyTemplateTicket(issues['inProgress']);
        var col4Content = self.applyTemplateTicket(issues['integration']);
        var col5Content = self.applyTemplateTicket(issues['resolved']);
        //var col6Content = self.applyTemplateTicket(issues['done']);

        $(div).append(self.applyTemplateCol('Backlog', 'col1', col1Content));
        $(div).append(self.applyTemplateCol('Todo', 'col2', col2Content));
        $(div).append(self.applyTemplateCol('In progress', 'col3', col3Content));
        $(div).append(self.applyTemplateCol('Integration', 'col4', col4Content));
        $(div).append(self.applyTemplateCol('Resolved', 'col5', col5Content));
        //$(div).append(self.applyTemplateCol('Done', 'col6', col6Content));
        $(div).append($('<div class="credits">Kanbanise ' 
                        + VERSION
                        + ' - brought to you by <a href="http://www.boxuk.com/">Box UK</a>'
                        + ' | <a href="http://github.com/boxuk/kanbanise-redmine/issues">Feedback</a></div>'));

        $(div).click(function() {
            showMessage("Press 'escape' to close");
            $(msgWin).delay(3000).fadeOut('slow');
        });

        // Close Kanbanise on `esc`
        $(document).keyup(function(e) {
            if(e.keyCode == 27){
                $('#kanban').remove();
            }
        });

        return div;
    }

    /**
     * Add CSS rules to document header
     */
    function addStyling() {
        $("<style type='text/css'> .ui-state-hover{ background: blue !important; }\n"
        + "#kanban { z-index:1000;position:absolute;left:0;top:0;width:100%;min-height:100%;background:#164B69; }\n"
        + "#kanban h3 { color: #fff;margin-bottom:4px;display:block; }\n"
        + ".story-points { float:right;font-size:11px;}\n"
        + ".card, .column { border-radius: 4px; box-shadow: 0 0 8px rgba(0, 0, 0, 0.6), inset 0px 0px 6px rgba(64, 116, 188, 0.4); margin: 0 0 7px 0; }\n"
        + ".card { background: #fefefe; padding: 5px;}\n"
        + ".ticket {border-left: 12px solid #212121;}\n"
        + ".ticket a {color: #10384f;}\n"
        + ".ticket .icon {float: right; height: 10px; opacity: 0.5;}"

        + ".ticket.nature-task .icon {background: url(http://twitter.github.com/bootstrap/assets/img/glyphicons-halflings.png) no-repeat; background-position: -380px -145px;}\n"
        + ".ticket.nature-feature .icon {background: url(http://twitter.github.com/bootstrap/assets/img/glyphicons-halflings.png) no-repeat; background-position: -165px 0px;}\n"
        + ".ticket.nature-bug .icon {background: url(http://twitter.github.com/bootstrap/assets/img/glyphicons-halflings.png) no-repeat; background-position: -356px -145px;}\n"
        + ".ticket.nature-activity .icon {background: url(http://twitter.github.com/bootstrap/assets/img/glyphicons-halflings.png); background-position: -48px -120px;}\n"
        + ".ticket.nature-feedback .icon {background: url(http://twitter.github.com/bootstrap/assets/img/glyphicons-halflings.png); background-position: -91px -120px;}\n"
        + ".ticket.children {width: 92%; margin-left: 2.8%;}\n"
        + ".nature-feature {border-left: 12px solid #a0d3d8;}\n"
        + ".nature-bug {border-left: 12px solid #dfa878;}\n"
        + ".nature-activity {border-left: 12px solid #d9df78;}\n"
        + ".nature-feedback {border-left: 12px solid #dfa4dc;}\n"
        + ".severity-blocker {}"
        + ".severity-critical {}"
        + ".severity-major {}"
        + ".severity-moderate {}"

        + ".card h3{ display: block; margin-bottom: 0.1em; overflow: hidden;}\n"
        + ".column { border:1px solid rgba(255, 255, 255, 0.1);margin:5px;padding:5px 10px;background: #084563; box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.3)}\n"
        + ".column h1 { color: #fff;margin-bottom:4px;display:block; }\n"
        + ".columnWrapper { float:left;width: 20%;}\n"
        + ".smallcolumnWrapper { float:left;width: 2.5%; }\n"
        + ".issue-id {float:right;font-size:10px;}\n"
        + ".assigned-to {display: inline; font-size: 10px; text-transform: uppercase;}\n"
        + ".credits { clear:both;color:#fff;font-size:0.7em;margin-left:20px;margin-bottom: 20px;}\n"
        + ".credits a { color: #fff; font-weight: bold}\n"
        + "div#msgWin {position:fixed;right:0px;top:0px;z-index:30000;background:black;border:white 1px solid;padding: 3px; color: #fff}\n"
        + ".placeholder { height: 30px;background: yellow;}\n"
        + "ul.sortable { list-style-type: none;padding:0;margin-left:0}\n"
        + ".sortable li {cursor:wait;}\n"
        + "</style>").appendTo("head");
    }

    // main
    addStyling();
    var issues = getIssues();
    var div = createBoard();
    $('body').append(div);
    drawBoard(issues);
    loadApiKey(issues);
    resizeColumns();
};

(function () {
    "use strict";
    var MIN_JQUERY_VERSION = '1.8.1';
    var k = new Kanbanise();

    // if running in unit test mode
    if(typeof(jasmine) !== 'undefined') {
        return;
    }

    function loadJQueryUI() {
        Kanbanise.log("Loading jQuery UI...");
        var done = false;
        var script = document.createElement("script");
        script.src = "http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.23/jquery-ui.min.js";
        script.onload = script.onreadystatechange = function() {
            if(!done && (!this.readyState || this.readyState === "loaded"
                || this.readyState == "complete"))
            {
                Kanbanise.log("Loaded jQuery UI");
                done = true;
                k.init();
            }
        };
        document.getElementsByTagName("head")[0].appendChild(script);
    }

    function loadJQuery() {
        Kanbanise.log("Loading jQuery...");
        var done = false;
        var script = document.createElement("script");
        script.src = "http://ajax.googleapis.com/ajax/libs/jquery/" + MIN_JQUERY_VERSION + "/jquery.min.js";
        script.onload = script.onreadystatechange = function() {
            if(!done && (!this.readyState || this.readyState === "loaded"
                || this.readyState == "complete"))
            {
                Kanbanise.log("loaded jQuery");
                jQuery.noConflict();
                done = true;
                loadJQueryUI();
            }
        };
        document.getElementsByTagName("head")[0].appendChild(script);
    }

    Kanbanise.log("Loading Kanbanise...");

    // Ensure jQuery and jQuery UI are loaded and available before
    // loading kanbanise
    if(    window.jQuery === undefined
        || window.jQuery.fn.jquery < MIN_JQUERY_VERSION
        || window.jQueryUI === undefined)
    {
        loadJQuery();
    } else {
        k.init();
    }

}());
