var Update = {};
(function () {

    /**
     * The bootstrap of the Update Mod.
     */
    Update.init = function () {
        Update.initContextMenu();
        Update.addResources();
        Update.initFeatureList();
    };

    /**
     * Injects our dialog into the dom
     */
    Update.initFeatureList = function () {
        $("#resources").append($(Update.featureListHtml));
    }

    /**
     * Adds research items, events, etc.
     */
    Update.addResources = function () {
        GDT.addResearchItem(
            {
                id: "Game Updates",
                name: "Game Updates".localize(),
                v: 4, //Tech level
                canResearch: function (company) {
                    return Update.Helpers.Researched("Custom Engine");
                },
                category: "General",
                categoryDisplayName: "General".localize()
            }
        );
    }

    this._showContextMenu = undefined;
    /**
     * Replaces the context menu handler with our own function.
     */
    Update.initContextMenu = function () {
        this._showContextMenu = UI.showContextMenu;
        UI.showContextMenu = Update.showContextMenu;
    };

    Update.storage = DataStore;

    Update.Helpers = {
        Researched: function (id) {
            var res = false;
            GameManager.company.researchCompleted.forEach(function (x) {
                if (x.id == id) res = true;
            });
            return res;
        }
    };

    /**
     * Tutorial module specifically for the Update Mod
     * @type {{}}
     */
    Update.Tutorial = {};
    (function () {
        //helper
        var show = function (id, msg) {
            if (!Update.storage.getValue("updatemod-" + id)) {
                var b = new Notification({header: "Tutorial ".localize(), text: msg, image: "mods/jariz-update/art/update.png"});
                b.weeksUntilFired = 1;
                GameManager.company.notifications.push(b);
                GameManager.showPendingNotifications();
            }
        }
        Update.Tutorial.updateIntro = function () {
            show("updateintro", "Updating your games keeps your fans happy and may even boost sales / hype.\nIt is important that you keep updating your games in order to keep up the sales and not lose any fans.".localize())
        }
    })();

    /**
     * This function overrides the default game behaviour for showing the context menu.
     * It attempts to add an extra option to it.
     * @param menu
     * @returns {*}
     */
    Update.showContextMenu = function (menu) {
        var company = GameManager.company;
        var selectedChar = 1 < company.currentLevel ? UI.getCharUnderCursor() : company.staff[0];
        if (!selectedChar && Update.Helpers.Researched("Game Updates") && GameManager.isIdle())
            menu.push({
                label: "Create update...",
                action: Update.showGamePicker
            });

        //forward call
        return Update._showContextMenu.apply(UI, arguments);
    };

    /**
     * Shows the feature list for this game.
     * Features it will show will depend on it's engine.
     * @param game
     */
    Update.showFeatures = function (game) {
        $("#updateFeatureList").find(".selectionOverlayContainer").hide();
        UI.showModalContent("#updateFeatureList", {disableCheckForNotifications: !0, close: !0, onOpen: function () {}})
        Update.loadEngineParts(game);
    };

    /**
     * Shows the engine parts in the feature list dialog
     */
    Update.loadEngineParts = function (game) {
        var selectedEngineParts = [];
        var updateButton = function (enabled) {
            var modalContent = $(".simplemodal-data");
            var button = modalContent.find("#createUpdateButton");
            if (enabled) {
                if (!button.hasClass("orangeButton")) {
                    button.removeClass("disabledButton").addClass("orangeButton");
                    button.clickExcl(function () {
                        UI.closeModal();
                        Update.startUpdate(game, selectedEngineParts, modalContent.find(".updateVersionInput").val());
                    })
                }
            } else {
                if (button.hasClass("disabledButton"))
                    return;
                button.removeClass("orangeButton").addClass("disabledButton").unbind("click")
            }
        };

        var updateCost = function () {
            var cost = selectedEngineParts.sum(function (o) {
                return Research.getEngineCost(o)
            });
            var modalContent = $(".simplemodal-data");
            var costLabel =
                modalContent.find("#updateCosts");
            costLabel.text("{0}".localize().format(UI.getShortNumberString(cost)));
            if (cost > GameManager.company.cash) {
                costLabel.addClass("red");
                updateButton(false)
            } else {
                costLabel.removeClass("red");
                updateButton(selectedEngineParts.length > 0)
            }
        };

        console.log(game);
        var enginePartsContainer = $("#updateFeatureList .enginePartsContainer"), d = game.engine.parts.groupBy(function (a) {
            return a.category
        });
        enginePartsContainer.empty();
        var f = null;
        var toggle = function(feature, object) {
            if(!$(feature).hasClass("disabled"))
                if($(feature).hasClass("selectedFeature")) {
                    $(feature).removeClass("selectedFeature")
                    selectedEngineParts.pop(object);
                }
                else {
                    $(feature).addClass("selectedFeature")
                    selectedEngineParts.push(object);
                }
        };
        for (l = 0; l < d.length; l++) {
            var m = d[l];
            m.category != f && (enginePartsContainer.append($('<div class="featureSelectionCategoryHeading">{0}</div>'.format(m.categoryDisplayName))), f = m.category);
            var feature = UI.generateFeatureElement(m);
            feature.find(".featureContent").text("{0} ({1})".format(m.name, UI.getShortNumberString(Research.getEngineCost(m))));
            feature.addClass("radioButton");
            feature.clickExcl(function () {
                toggle(this, m);
                updateCost();
            });

            //if it's already part of the game, make it disabled
            if(game.features.contains(m))
                feature.addClass("disabled");

            enginePartsContainer.append(feature)
        }
    };

    Update.game = null;

    /**
     * Start the actual working process, after choosing the new features
     * @param game
     * @param new_features
     */
    Update.startUpdate = function (game, new_features, version) {
        VisualsManager.gameStatusBar.updateStatusMessage("");
        VisualsManager.gameStatusBar.startDevelopment();
        VisualsManager.putConsoleToPedestal();
//        GameManager.executeFeatures([], Missions.PreparationMission);

        //add/generate game
        Update.game = game;
        Update.game.id = Update.game.id+"-UPDATE-"+new Date().getTime();
        Update.game.title = version + " of " + Update.game.title;
        GameManager.company.currentGame = Update.game;
        //add features
        GameManager.plannedFeatures.push({
            type : "focus",
            id : "preparation",
            missionType : "preparation"
        });
        //work on said features
        GameManager.transitionToState(State.ExecuteWorkItems);
        //add the rest

        Update.handleMissions(Missions.Stage1Missions);
        Update.handleMissions(Missions.Stage2Missions);
        Update.handleMissions(Missions.Stage3Missions);

        //probably the best way to do this without having to hook into the games renderloop or something
        //if you know something better, YOU TELL ME, don't judge me ok :(
//        setTimeout(function() {
//            GameManager.executeFeatures(new_features)
//        }, 3000);

//        //update ui
//        VisualsManager.gameStatusBar.startDevelopment()
//        VisualsManager.gameStatusBar.updateGameName(game.name);
//        VisualsManager.gameStatusBar.updateStatusMessage("Preparing...");
//
//        //set all chars to working state
//        for (var f = GameManager.company.staff.filter(function (a) {
//            return a.state === CharacterState.Idle
//        }), c = 0; c < f.length; c++)f[c].startWorking()
    };

    /**
     * Convenience method for adding missions in bulk
     */
    Update.handleMissions = function(missions) {
        for (var i = 0; i < missions.length; i++) {
            missions[i].percentage = 0;
            GameManager.plannedFeatures.push({
                type : "focus",
                id : missions[i].id,
                missionType : "mission"
            })
        }
    }

    /**
     * Shows the 'select game' dialog and processes it's input.
     */
    Update.showGamePicker = function () {
        Sound.click();
        GameManager.flags.selectGameActive = 1;
        GameManager.flags.selectedGameId = null;
        UI.showGameHistory(function () {
            GameManager.flags.selectGameActive = 0;
            //did the user select a game?
            if (GameManager.flags.selectedGameId != null) {
                var game = GameManager.company.getGameById(GameManager.flags.selectedGameId);
                console.log("Callback from game picker: ", game);
                if (game.engine == null)
                    GameManager.company.notifications.push(new Notification({header: "Woops!", text: "You can only update a game that has a engine."}));
                else
                    Update.showFeatures(game);
            }
        });
    };

    Update.featureListHtml = '<div id="updateFeatureList" class="windowBorder tallWindow">' +
        '<div class="windowTitle">Update game</div>' +
        '<div class="updateFeatureListContainer">' +
        '<div style="padding-left: 20px;padding-top: 17px;">' +
        '<input type="text" placeholder="Version..." class="updateVersionInput" maxlength="20" style="font-size: 18pt">' +
        '<div style="float:right;margin-right: 20px;font-size: 26px;">Costs: <strong id="updateCosts">0K</strong></div> '+
        '</div>' +
        '<div class="enginePartsContainer"></div>' +
        '</div>' +
        '<div class="cen">' +
        '<div id="createUpdateButton" class="okButton baseButton disabledButton windowMainActionButton windowLargeOkButton">Create update</div>' +
        '</div>' +
        '<div class="selectionOverlayContainer" style="display: none;">' +
        '<div class="listContainer"></div>' +
        '</div>' +
        '</div>';


    //utility
    Array.prototype.contains = function(obj) {
        var i = this.length;
        while (i--) {
            if (this[i] === obj) {
                return true;
            }
        }
        return false;
    }

})();