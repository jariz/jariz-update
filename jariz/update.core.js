/**
 * Copyright Jari Zwarts 2013
 * Licensed under the Creative Common Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0) license
 * Please read the LICENSE file for the entire license.
 * Made with <3 for GDT
 */


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

    Update.isResearched = false;
    Update.promisedUpdates = [];

    /**
     * Injects our dialog into the dom
     */
    Update.initFeatureList = function () {
        $("#resources").append($(Update.featureListHtml));
    }

    Update.newsSources = ["Star Games", "Informed Gamer", "Game Hero", "All Games"];

    /**
     * Adds research items, events, etc.
     */
    Update.addResources = function () {

        GDT.on(GDT.eventKeys.saves.loading, function (data) {
            Update.isResearched = Update.Helpers._Researched("Game Updates", data.data.company.researchCompleted);
            console.log("Loading event callback, isResearched=" + Update.isResearched);
        });

        Research.BasicItems.push(
            {
                id: "Game Updates",
                name: "Game Updates".localize(),
                pointsCost: 20,
                duration: 1500,
                category: "General",
                categoryDisplayName: "General"
            }
        );

        GDT.on(GDT.eventKeys.gameplay.researchCompleted, function () {
            if (!Update.isResearched && Update.Helpers.Researched("Game Updates")) {
                Update.Tutorial.updateIntro();
                Update.isResearched = true;
            }
            console.log("ResearchCompleted event callback, isResearched=" + Update.isResearched);
        });

        var promised_game = null;
        GDT.addEvent(
            {
                id: "UpdateWarning",
                isRandom: true,
                maxTriggers: false,
                trigger: function (company) {
                    var games = Sales.getGamesToSell(company);
                    var ret;
                    games.forEach(function (game) {
                        if (ret) return;
                        //we're in 2nd sales week & our game sucks balls
                        ret = !game.flags.updateWarned && game.salesCashLog.length == 2 && !Update.Helpers.isGameFullyUtilisingEngine(game);
                    });
                    return ret;
                },
                getNotification: function (company) {
                    var games = Sales.getGamesToSell(company);
                    var game = null;
                    games.forEach(function (game_) {
                        //we're in 2nd sales week & our game sucks balls
                        if (game.salesCashLog.length == 2 && !Update.Helpers.isGameFullyUtilisingEngine(game_))
                            game = game_;
                    });
                    promised_game = game;

                    if (!game) throw "Ermmm, couldn't get the game I was looking for (updatemod), please contact halp@jari.io";

                    var messages = [ //0 = newssource, 1 = game, 2 = company
                        "{0} reports: 'Fans were unpleasantly surprised when picking up {1} last week, the game, appears to be missing a lot of it's features that the engine does support.\n"
                            + "We at {0} really hope the manufacturer of {1} - {2} - will set this straight by releasing an update that will reintroduce these features we all love and have accustomed to.'",

                        "'{0} with breaking news here: Last week's {1} is missing a severe amount of features and fans are outraged! when asking about an explanation {2} replied with:",

                        "{0} on the phone: 'Any explanation why your latest release ({1}) had so little features, while the engine has so many?'"
                    ];

                    //only add the forum message when the internet is invented
                    if (company.getCurrentDate().year >= 15) messages.push("Boss, I was browsing the {0} forums today and it appears a lot of hardcore fans are pretty disappointed about the features of {1} despite our engine being able to handle so much more features.\nWhat do we do? we could lose a lot of fans if we don't fix this!");

                    return new Notification({
                        sourceId: "UpdateWarning",
                        header: "Fan outrage!".localize(),
                        text: messages.pickRandom().format(Update.newsSources.pickRandom(), game.title, company.name),
                        options: ["We will release an update ASAP", "No commentary"]
                    });
                },
                complete: function (decision) {
                    var company = GameManager.company;
                    game.flags.updateWarned = true;

                    switch (decision) {
                        case 0:
                            if (!Update.isResearched) {
                                company.notifications.push(new Notification({
                                    header: "Woops!",
                                    text: "You promised an update but we're unable to, We haven't researched it yet!\nI'd suggest you too research it quickly before the press get a hold of this!"
                                }))
                            } else company.notifications.push(new Notification({
                                header: Update.newsSources.pickRandom(),
                                text: "Word just got in {0} that has promised us a new update that will include much more features! Fans are eagerly awaiting this new version.".format(company.name)
                            }));

                            //if you're promising an update but haven't even researched it yet, you'll get fucked even harder in the next event :)
                            Update.promisedUpdates.push({game: promised_game.id, notResearchedYet: !Update.isResearched, warnedTime: company.getCurrentDate()});
                            break;
                        case 1:
                            company.notifications.push(new Notification({
                                header: "Woops!",
                                text: "BREAKING: Word just got in {0} that has promised us a new update that will include much more features! Fans are eagerly awaiting this new version.".format(company.name)
                            }));
                            break;
                    }
                }
            }
        );

        var failure_game;
        GDT.addEvent(
            {
                id: "UpdateFailureToComply",
                isRandomEvent: true,
                trigger: function (company) {
                    var games = Sales.getGamesToSell(company);
                    var ret;
                    games.forEach(function (game) {
                        if (ret) return;
                        //we're in 4nd sales week and we've been warned
                        ret = game.flags.updateWarned && !game.flags.updateFailureToComply && game.salesCashLog.length == 4;
                        failure_game = game;
                    });
                    return ret;
                },
                getNotification: function (company) {
                    var game = failure_game;

                    //did the user made a change to the game?
                    var notif;
                    if (Update.Helpers.isGameFullyUtilisingEngine(game)) {
                        //TODO we're not checking if we've even promised something
                        notif = new Notification({
                                header:Update.newsSources.pickRandom(),
                                text: "It appears that {0} is a company that sticks to it's word, as it has just released a huge update which fixes a lot of problems people were having with {1}.\nThe fans are pleased and the media is speaking about it positively.\nThey handled this very well!".format(company.name, game.title)
                            });
                        notif.adjustFans(200);
                    } else {
                        //didn't change anything, get promise object
                        //TODO pop promise
                        //TODO check fullyutilisingengine if we're gonna put above part into below part
                        Update.promisedUpdates.filter(function(promise) {
                            if(promise.notResearchedYet == !Update.Helpers.Researched("Game Updates") && promise.game == game.id) {
                                notif = new Notification({
                                    header:Update.newsSources.pickRandom(),
                                    text: "BREAKING NEWS: Despite their fans begging for a update - still hasn't released one.\nA few weeks ago {0} replied with that 'they would handle it ASAP', but at last, still no sign of any update\nA close source has informed us that {0} didn't do so simply because they \"Didn't knew how\" as they have never released an update neither knew how to.\nThis massive scandal is something the media and the fans won't forget for some time...".format(company.name, game.title)
                                });
                                notif.adjustFans(-500);
                            } else if(promise.game == game.id) {
                                notif = new Notification({
                                    header:Update.newsSources.pickRandom(),
                                    text: "BREAKING NEWS: Despite their fans begging for a update - still hasn't released one.\nA few weeks ago {0} replied with that 'they would handle it ASAP', but at last, still no sign of any update\nLittle Johnny (a 12 year old fan) replied with: 'It's kind of what we're starting to expect of {0}...' as he threw his {0} t-shirt away.".format(company.name, game.title)
                                });
                                notif.adjustFans(-300);
                            }
                        })
                    }

                    return notif;
                },
                complete: function (decision) {

                }
            }
        );
    }

    Update._showContextMenu = undefined;
    /**
     * Replaces the context menu handler with our own function.
     */
    Update.initContextMenu = function () {
        Update._showContextMenu = UI.showContextMenu;
        UI.showContextMenu = Update.showContextMenu;
    };

    Update.storage = DataStore;

    Update.Helpers = {

        /**
         * Determines if a research item is researched already.
         * @param id The game id
         * @returns boolean
         */
        Researched: function (id) {
            return Update.Helpers._Researched(id, GameManager.company.researchCompleted);
        },

        _Researched: function (id, array) {
            var ret = false;
            array.forEach(function (x) {
                if (x.id == id) ret = true;
            });
            return ret;
        },

        /**
         * Helper to determine if a game is fully using all of it's engine's features
         * @param game
         */
        isGameFullyUtilisingEngine: function (game) {
            var parts = game.engine.parts.length;
            var features = game.features.length;


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
//                b.weeksUntilFired = 1;
                GameManager.company.notifications.push(b);
                Update.storage.setValue("updatemod-" + id, true);
//                GameManager.showPendingNotifications();
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
        if (!UI.getCharUnderCursor() && Update.Helpers.Researched("Game Updates") && GameManager.isIdle())
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
        UI.showModalContent("#updateFeatureList", {disableCheckForNotifications: !0, close: !0, onOpen: function () {
        }})
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
        var toggle = function (feature, object) {
            if (!$(feature).hasClass("disabled"))
                if ($(feature).hasClass("selectedFeature")) {
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
            if (game.features.contains(m))
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
        Update.game.id = Update.game.id + "-UPDATE-" + new Date().getTime();
        Update.game.title = version + " of " + Update.game.title;
        GameManager.company.currentGame = Update.game;
        //add features
        GameManager.plannedFeatures.push({
            type: "focus",
            id: "preparation",
            missionType: "preparation"
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
    Update.handleMissions = function (missions) {
        for (var i = 0; i < missions.length; i++) {
            missions[i].percentage = 30;
            GameManager.plannedFeatures.push({
                type: "focus",
                id: missions[i].id,
                missionType: "mission"
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
        '<div style="float:right;margin-right: 20px;font-size: 26px;">Costs: <strong id="updateCosts">0K</strong></div> ' +
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
    Array.prototype.contains = function (obj) {
        var i = this.length;
        while (i--) {
            if (this[i] === obj) {
                return true;
            }
        }
        return false;
    }

})();