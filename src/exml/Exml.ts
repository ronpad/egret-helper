import * as fs from "fs";
import * as vscode from 'vscode';
import { localize } from "../common/Language";
import Listener from "../common/Listener";
import { getLogger, Logger } from "../common/Log";
import * as helper from "../helper";
import ExmlHoverProvider from './ExmlHoverProvider';
import ExmlLinkProvider from './ExmlLinkProvider';
import ExmlPathAutoCompleteProvider from './ExmlPathAutoCompleteProvider';


export default class Exml extends Listener {
	private logger: Logger;
	public constructor(protected subscriptions: vscode.Disposable[]) {
		super();
		this.logger = getLogger(this);
		this.logger.devlog("constructor");
		this.addListener(vscode.languages.registerHoverProvider(['typescript'], new ExmlHoverProvider()));
		this.addListener(vscode.languages.registerDefinitionProvider(['typescript'], new ExmlLinkProvider()));
		this.addListener(vscode.languages.registerCompletionItemProvider(['typescript'], new ExmlPathAutoCompleteProvider(), "="));

		this.addListener(vscode.commands.registerCommand("egret-helper.goToExml", () => {
			this.logger.devlog("egret-helper.goToExml");
			this.exec();
		}));
	}
	public exec() {
		let activieWin = vscode.window.activeTextEditor;
		if (!activieWin) {
			this.logger.devlog(localize("exml.notfindwin"))
			return;
		}
		let doc = activieWin.document;
		let count = doc.lineCount;
		let results: string[] = [];
		for (let i = 0; i < count; i++) {
			let line = doc.lineAt(i);
			results.push(...this.collectOneLineExml(line));
		}
		if (results.length) {
			if (results.length == 1) {
				this.openExml(results[0]);
			} else {
				vscode.window.showQuickPick(results).then(pickurl => {
					if (!pickurl) return;
					this.openExml(pickurl);
				})
			}
		}
	}
	//收集一行行的exml
	private collectOneLineExml(line: vscode.TextLine) {
		let matchResult = helper.getSkinExmlDefine(line.text);
		let results: string[] = [];
		if (matchResult != null) {
			for (let i = 0; i < matchResult.length; i++) {
				let destExmlPath = helper.convertFullPath(matchResult[i]);
				if (destExmlPath && fs.existsSync(destExmlPath)) {
					results.push(destExmlPath);
				}
			}
		}
		return results;
	}
	private openExml(urlstr: string) {
		let configs = helper.getConfigObj();
		if (configs.exmlOpenExternal) {
			//调用外部编辑器
			helper.openExmlEditor(urlstr).then(progress => {
				this.logger.devlog("open success!");
			}).catch(err => {
				this.logger.devlog(err);
				this.openByVsCode(urlstr);
			});
		} else {
			this.openByVsCode(urlstr);
		}
	}
	private openByVsCode(urlstr: string) {
		vscode.workspace.openTextDocument(vscode.Uri.file(urlstr)).then(
			document => vscode.window.showTextDocument(document)
		)
	}
}