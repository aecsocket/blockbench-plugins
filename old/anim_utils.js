(function() {
    Plugin.register("anim_utils", {
        title: "Anim Utils",
        icon: "pages",
        author: "aecsocket",
        description: "Animation utils.",
        version: "1.3.2",
        min_version: "3.0.2",
        variant: "both",
        onload() {
            MenuBar.addAction(new Action("mirror_models", {
                icon: "pages",
                name: "Mirror right/left models",
                click: function() {
                    mirrorDisplayModels();
                }
            }));
            MenuBar.addAction(new Action("correct_hand_display", {
                icon: "pages",
                name: "Correct right hand display",
                click: function() {
                    correctRightHandDisplay();
                }
            }));
            MenuBar.addAction(new Action("correct_model", {
                icon: "pages",
                name: "Correct model",
                click: function() {
                    correctRightHandDisplay();
                    mirrorDisplayModels();
                }
            }));
            MenuBar.addAction(new Action("reinstate_model", {
                icon: "pages",
                name: "Reinstate model",
                click: function() {
                    reinstateDisplay();
                    mirrorDisplayModels();
                }
            }));
        },
        onunload() {
            this.onuninstall();
        },
        onuninstall() {
            MenuBar.removeAction("mirror_models");
            MenuBar.removeAction("correct_hand_display");
            MenuBar.removeAction("correct_model");
            MenuBar.removeAction("reinstate_model");
        }
    });

    function mirrorDisplayModels() {
        let rightSlot = display["firstperson_righthand"];
        let leftSlot = display["firstperson_lefthand"];
        leftSlot.rotation = [...rightSlot.rotation];
        leftSlot.translation = [...rightSlot.translation];
        leftSlot.scale = [...rightSlot.scale];
        leftSlot.mirror = [...rightSlot.mirror];
    }

    function correctRightHandDisplay() {
        display["firstperson_righthand"].translation[1] += 9.6;
    }

    function reinstateDisplay() {
        display["firstperson_righthand"].translation[1] -= 9.6;
    }
})();
