import * as fs from "fs";
import * as jju from "jju";
import * as vscode from "vscode";
import { LaunchJsonConfType } from "../define";
import Helper from "./Helper";
import Listener from "./Listener";
import { getLogger, Logger } from "./Logger";
export default class EgretConfigImpl extends Listener {
    protected logger: Logger;
    public constructor(protected subscriptions: vscode.Disposable[]) {
        super();
        this.logger = getLogger(this);
    }
    public async changeVSConfig() {
        let conf = vscode.workspace.getConfiguration("debug.javascript");
        if (!conf.usePreview) {
            this.logger.debug("changeVSConfig modify debug.javascript.usePreview = true")
            conf.update("usePreview", true);
        }
    }
    public async changeLaunchJson(url: string) {
        const CONF_KEY = "configurations";
        const launchPath = Helper.getLaunchJsonPath();
        const jsobjParam: jju.ParseOptions & jju.StringifyOptions = { reserved_keys: 'replace', quote: '"', quote_keys: true };
        if (!launchPath || !fs.existsSync(launchPath)) {
            this.logger.debug("changeLaunchJson create launchJson")
            await Helper.writeFile(launchPath, this.getTemplate(url));
        }
        const prevJsonStr = await Helper.readFile(launchPath);
        const jsObj = jju.parse(prevJsonStr, jsobjParam)

        let finalConfs: LaunchJsonConfType[];
        const curType = Helper.getDebugBrowser()

        if (!jsObj[CONF_KEY]) {
            this.logger.debug(`changeLaunchJson create configurations ${curType}`)
            finalConfs = [this.configTemplate(url)];

        } else {
            finalConfs = <LaunchJsonConfType[]>jsObj[CONF_KEY];

            let findIndex = finalConfs.findIndex(val => val.type == curType);
            if (findIndex == -1) {
                this.logger.debug(`changeLaunchJson push configurations ${curType}`)
                finalConfs.push(this.configTemplate(url));
            } else {
                this.logger.debug(`changeLaunchJson url replace configurations ${curType}`)
                if (finalConfs[findIndex].url != url) {
                    finalConfs[findIndex].url = url
                }
            }
        }

        this.logger.debug("changeLaunchJson seturl configurations：" + url);
        if (finalConfs.length > 1) {
            //先保存成一个 让vscode默认选中这个 之后在恢复之前的列表

            let findItem = finalConfs.find(val => val.type == curType);
            jsObj[CONF_KEY] = [findItem]
            let output = jju.update(prevJsonStr, jsObj, jsobjParam)

            this.logger.debug("changeLaunchJson temp save one configurations");

            Helper.writeFile(launchPath, output);
            await this.waitConfigSaveOk();
        }

        this.logger.debug("changeLaunchJson save all configurations");

        jsObj[CONF_KEY] = finalConfs;
        let output = jju.update(prevJsonStr, jsObj, jsobjParam)
        await Helper.writeFile(launchPath, output);
        this.logger.debug("changeLaunchJson save all configurations ok");
    }
    private waitConfigSaveOk() {
        return new Promise<void>((resolve, reject) => {
            let dispose = vscode.workspace.onDidChangeConfiguration((e) => {
                this.removeListener(dispose);
                resolve();
            });
            this.addListener(dispose);
        });
    }
    private getTemplate(url: string) {
        return `{
    // 使用 IntelliSense 了解相关属性。 
    // 悬停以查看现有属性的描述。
    // 欲了解更多信息，请访问: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        ${JSON.stringify(this.configTemplate(url), undefined, "\t\t\t").trimEnd().slice(0, -1)}        }
    ]
}`
    }
    private configTemplate(url: string) {
        const curType = Helper.getDebugBrowser()
        return <LaunchJsonConfType>{
            type: curType,
            request: "launch",
            name: Helper.getDebugName(),
            url: url,
            webRoot: "${workspaceFolder}"
        }
    }
    public async changeTsConfig() {
        //检查tsconfig的sourceMap是否存在 不存在就设置
        const jsobjParam: jju.ParseOptions & jju.StringifyOptions = { reserved_keys: 'replace', quote: '"', quote_keys: true }
        let ts_config_path = Helper.getTSConfigPath();
        this.logger.debug("changeTSConfig ts_config_path=", ts_config_path)
        let ts_config_str = await Helper.readFile(ts_config_path);

        let jsObj = jju.parse(ts_config_str, jsobjParam)

        this.logger.debug(jsObj)
        if (!jsObj.compilerOptions || !jsObj.compilerOptions.sourceMap) {
            this.logger.debug("changeTSConfig modify sourceMap=true")
            if (!jsObj.compilerOptions) jsObj.compilerOptions = {};
            jsObj.compilerOptions.sourceMap = true;
            let output = jju.update(ts_config_str, jsObj, jsobjParam)
            Helper.writeFile(ts_config_path, output);
        }
    }
}
