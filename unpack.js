(function() {

var button;

Plugin.register("unpack", {
    title: "Unpack",
    author: "aecsocket",
    icon: "fa-box-open",
    description: "Moves elements under a group to its parent",
    version: "1.0",
    variant: "both",
    onload() {
        button = new Action("unpack", {
            name: "Unpack",
            description: "Moves elements under the selected group to its parent",
            icon: "fa-box-open",
            click: function() {
                unpack();
            }
        });
        MenuBar.addAction(button, "edit");
    },
    onunload() {
        button.delete();
    }
});

function unpack() {
    if (!Group.selected) {
        Blockbench.showMessageBox({
            title: "Error",
            message: "You must select the group to unpack!"
        });
        return;
    }

    Undo.initEdit({group: Group.selected});
    Group.selected.resolve();
    Undo.finishEdit("unpack");
}

})();