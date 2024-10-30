import * as vscode from "vscode";

const EXTN_QUALIFIER = 'jump-easy';
const COMMANDS = Object.seal({
  jumpEasy: `${EXTN_QUALIFIER}.jump`
})

let cachedInput: string | undefined = undefined;
let statusbar: vscode.StatusBarItem;
let indexing: string = getEnumConfiguration('defaultIndex', 'zero based', ['zero based', 'one based']);

function select(editor: vscode.TextEditor, start: number, end: number) {
  let startPos = editor.document.positionAt(start);
  startPos = editor.document.validatePosition(startPos);

  let endPos = editor.document.positionAt(end);
  endPos = editor.document.validatePosition(endPos);

  const selection = new vscode.Selection(startPos, endPos);
  editor.selection = selection;
  editor.revealRange(selection);
}

/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context: vscode.ExtensionContext) {

  console.log('"jump-easy" is active');

  context.subscriptions.push(
    statusbar,

    vscode.window.onDidChangeTextEditorSelection(
      (e: vscode.TextEditorSelectionChangeEvent) => updateStatusBarItem(e.textEditor)
    ),
    vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor | undefined) => {
      if (e === undefined) return;
      updateStatusBarItem(e);
    }),

    vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
      if (e.affectsConfiguration(`${EXTN_QUALIFIER}.defaultIndex`))
        indexing = getEnumConfiguration('defaultIndex', 'zero based', ['zero based', 'one based']);

      if (e.affectsConfiguration(`${EXTN_QUALIFIER}.statusbar`))
        updateStatusBarItemPriority(getConfiguration("statusbar.priority", 101));
    }),

    vscode.commands.registerTextEditorCommand(COMMANDS.jumpEasy, async (editor) => {
      const indexing = getEnumConfiguration('defaultIndex', 'zero based', ['zero based', 'one based']);

      const input = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        prompt: `Your current index setting is ${indexing} and there are ${new Intl.NumberFormat().format(editor.document.getText().length)} characters in this text body`,
        title: "Jump to an absolute character index in the active editor",
        value: cachedInput === undefined ? '' : cachedInput,
        validateInput: (value) => {
          if (!value.match(/^\d+$/m) || !value.match(/^\d+:\d+$/m))
            return `Invalid input. Please enter a valid positive whole number ${value}`
          return null;
        }
      });

      if (input === undefined) return
      cachedInput = input;

      if (input.includes(":")) {
        let [start, end] = input.split(":").map(i => clamp(+i, 0))
        if (indexing === 'one based') {
          start = clamp(start - 1, 0)
          end = clamp(end - 1, 0)
        }
        select(editor, start, end)
      } else {
        let index = clamp(+input, 0);

        if (indexing === 'one based') index = clamp(index - 1, 0)

        let target = editor.document.positionAt(index);
        target = editor.document.validatePosition(target);

        editor.revealRange(new vscode.Range(target, target), getRevealType());
        editor.selection = new vscode.Selection(target, target);
      }

    })
  );

  updateStatusBarItemPriority(101);
}

export function deactivate() { }

function getRevealType() {
  const revealType = getEnumConfiguration('revealType', 'top', ['top', 'center', 'default', 'centerifoutsidetheviewport']);

  switch (revealType) {
    case 'default':
      return vscode.TextEditorRevealType.Default
    case 'center':
      return vscode.TextEditorRevealType.InCenter
    case 'centerifoutsidetheviewport':
      return vscode.TextEditorRevealType.InCenterIfOutsideViewport
    default:
      return vscode.TextEditorRevealType.AtTop
  }
}

function getConfiguration(identifier: string, defalt: any): any {
  return vscode.workspace.getConfiguration(EXTN_QUALIFIER).get(identifier, defalt);
}

function getEnumConfiguration(identifier: string, defaultConfig: string, possibles: string[] = []) {
  let enumType = vscode.workspace.getConfiguration(EXTN_QUALIFIER).get(identifier) as string;
  enumType = possibles.includes(enumType.toLowerCase()) ? enumType.toLowerCase() : defaultConfig.toLowerCase();

  return enumType
}

function clamp(val: number, min: number, max = Number.POSITIVE_INFINITY) {
  if (val < min) return min;
  if (val > max) return max;

  return val
}

function updateStatusBarItemPriority(priority: number) {
  if (statusbar) statusbar.dispose();

  statusbar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, priority);
  statusbar.name = '↷ Go To Character Index';
  statusbar.tooltip = `↷ Current Index${indexing === 'one based' ? '¹' : 'º'}`;
  statusbar.command = COMMANDS.jumpEasy;
  statusbar.show();
}

function updateStatusBarItem(e: vscode.TextEditor) {
  const index = e.document.offsetAt(e.selection.active) + +(indexing === 'one based');

  statusbar.text = `↷ ${index.toLocaleString()}${indexing === 'one based' ? '¹' : 'º'}`;
}