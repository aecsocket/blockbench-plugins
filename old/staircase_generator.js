
(function() {
    Plugin.register("staircase_generator", {
        title: "Staircase Generator",
        icon: "pages",
        author: "aecsocket",
        description: "Generates staircases.",
        version: "1.3.2",
        min_version: "3.0.2",
        variant: "both",
        onload() {
            generate_staircase_action = new Action("generate_staircase", {
                icon: "pages",
                name: "Generate staircase",
                click: function() {
                    openGenerateWindow();
                }
            });
            MenuBar.addAction(generate_staircase_action, "filter");
        },
        onunload() {
            this.onuninstall();
        },
        onuninstall() {
            generate_staircase_action.delete();
        }
    });

    function getAxes(id, defaultValue) {
        return `
            <select style="color:var(--color-text)" id="` + id + `">
                <option ` + (defaultValue === 0 ? `selected=true ` : ``) + `>X</option>
                <option ` + (defaultValue === 1 ? `selected=true ` : ``) + `>Y</option>
                <option ` + (defaultValue === 2 ? `selected=true ` : ``) + `>Z</option>
            </select><br/>
        `;
    }

    function getHalf(id, defaultValue) {
        return `
            <select style="color:var(--color-text)" id="` + id + `">
                <option ` + (defaultValue === 0 ? `selected=true ` : ``) + `>Bottom</option>
                <option ` + (defaultValue === 1 ? `selected=true ` : ``) + `>Top</option>
            </select><br/>
        `;
    }

    function swapAxes() {
        t = $("widthAxis").selectedIndex;
        $("widthAxis").selectedIndex = $("heightAxis").selectedIndex;
        $("heightAxis").selectedIndex = t;
    }

    function openGenerateWindow() {
        if (selected.length > 0) {
            var window = new Dialog({
                title: "Generate staircase",
                id: "staircase_generator",
                lines: [
                    "Step Width: <input value=1 type='number' id='stepWidth' class='dark_bordered medium_width'> <br/>" +
                    "Block Height: <input value=-1 type='number' id='blockHeight' class='dark_bordered medium_width'> <br/>" +
                    "Width Axis: " + getAxes("widthAxis", 0) +
                    "Height Axis: " + getAxes("heightAxis", 1) +
                    "<button id='swap'>Swap</button> <br/>" +
                    "Half: " + getHalf("direction", 0) +
                    "Delete Base Cubes: <input type='checkbox' id='deleteBaseCubes'><br/>"
                ],
                draggable: true,
                onConfirm() {
                    window.hide();
                    console.log($("widthAxis").selectedIndex + " / " + $("heightAxis").selectedIndex);
                    generateStaircase(
                        Number($("stepWidth").val()),
                        Number($("blockHeight").val()),
                        $("widthAxis").selectedIndex,
                        $("heightAxis").selectedIndex,
                        $("direction").selectedIndex,
                        $("deleteBaseCubes").is(":checked"));
                }
            });

            window.show();
            $("swap").onclick = swapAxes;

            if (localStorage.getItem("stepWidth") != undefined) {
                $("stepWidth").val(localStorage.getItem("stepWidth"));
                $("blockHeight").val(localStorage.getItem("blockHeight"));
                $("widthAxis").selectedIndex = localStorage.getItem("widthAxis");
                $("heightAxis").selectedIndex = localStorage.getItem("heightAxis");
                $("direction").selectedIndex = localStorage.getItem("direction");
                $("deleteBaseCubes").prop("checked", localStorage.getItem("deleteBaseCubes") == "true");
            }
        } else {
            Blockbench.showMessageBox({
                title: "Error!", icon: "error",
                message: "You must select at least 1 element!",
                buttons: ["OK"]
            });
        }
    }

    function generateStaircase(stepWidth, blockHeight, widthAxis, heightAxis, direction, deleteBaseCubes) {
        // Handle invalid inputs
        if (widthAxis === heightAxis) {
            Blockbench.showMessageBox({
                title: "Error!", icon: "error",
                message: "Width and height axes cannot be the same!",
                buttons: ["OK"]
            });
            return;
        }

        if (stepWidth <= 0) {
            Blockbench.showMessageBox({
                title: "Error!", icon: "error",
                message: "Step width cannot be less than 0!",
                buttons: ["OK"]
            });
            return;
        }

        // Save to localStorage
        localStorage.setItem("stepWidth", stepWidth);
        localStorage.setItem("blockHeight", blockHeight);
        localStorage.setItem("widthAxis", widthAxis);
        localStorage.setItem("heightAxis", heightAxis);
        localStorage.setItem("direction", direction);
        localStorage.setItem("deleteBaseCubes", deleteBaseCubes);

        // Determine unused axis
        unusedAxis = 0;
        if (widthAxis === unusedAxis || heightAxis === unusedAxis) {
            unusedAxis = 1;
            if (widthAxis === unusedAxis || heightAxis === unusedAxis) {
                unusedAxis = 2;
            }
        }

        // Get locations
        var from = [];
        var to = [];

        selected.forEach(e => {
            var thisFrom = e.from;
            var thisTo = e.to;

            for (var i = 0; i < 3; i++) {
                if (thisFrom[i] < from[i] || from[i] == null) {
                    from[i] = thisFrom[i];
                }
                if (thisTo[i] > to[i] || to[i] == null) {
                    to[i] = thisTo[i];
                }
            }
        });

        // Calculate variables
        var width = to[widthAxis] - from[widthAxis];
        var height = to[heightAxis] - from[heightAxis];
        var stepHeight = height / (width / stepWidth);
        var steps = width / stepWidth;

        var center = [
            from[0] + ((to[0] - from[0]) / 2),
            from[1] + ((to[1] - from[1]) / 2),
            from[2] + ((to[2] - from[2]) / 2),]
        var origCube = selected[0];

        // Create group
        Undo.initEdit({elements: Outliner.elements, outliner: true});

        var group = new Group("staircase").init();
        
        // Create blocks

        var newCubes = []

        var thisFrom = from.slice();
        if (direction === 1) {
            thisFrom[widthAxis] = to[widthAxis] - stepWidth;
            thisFrom[heightAxis] = to[heightAxis] - stepHeight;
        }

        var thisTo = thisFrom.slice();
        thisTo[unusedAxis] = to[unusedAxis];
        thisTo[widthAxis] += stepWidth;
        if (blockHeight > 0)
            thisTo[heightAxis] += blockHeight;
        else
            thisTo[heightAxis] += stepHeight;


        for (var i = 0; i < steps; i++) {
            var cube = new Cube({
                name: "staircase_" + i,
                from: thisFrom,
                to: thisTo,
                origin: center,
                rotation: origCube.rotation
            }).addTo(group).init();
            newCubes.push(cube);

            if (direction === 0) {
                if (blockHeight > 0)
                    thisFrom[heightAxis] += (thisTo[heightAxis] - thisFrom[heightAxis]) - blockHeight + stepHeight;
                thisFrom[widthAxis] += stepWidth;

                thisTo[widthAxis] += stepWidth;
                thisTo[heightAxis] += stepHeight;
            } else {
                thisFrom[widthAxis] -= stepWidth;
                thisFrom[heightAxis] -= stepHeight;

                thisTo[widthAxis] -= stepWidth;
                if (blockHeight > 0)
                    thisTo[heightAxis] -= (thisTo[heightAxis] - thisFrom[heightAxis]) - blockHeight;
            }

        }

        if (deleteBaseCubes) {
            selected.forEach(e => e.remove())
        }

        group.selectChildren();
        group.showInOutliner();

        Undo.finishEdit("Created staircase");
    }
})();