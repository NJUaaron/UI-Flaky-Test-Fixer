const fs = require('fs');
const { MUTATIONS_LOG_PATH } = require('./lib/global')

var FTFixer = {}


FTFixer.waitFor = async function (timeout = 2000) {
    return new Promise(r => {
        setTimeout(() => {
            r();
        }, timeout);
    });
}

FTFixer.waitUntil = async function (conFunc, timeout = 2000, interval = 10) {    // conFunc: condition function(async)
    var timeoutFlag = false;
    setTimeout(() => timeoutFlag = true, timeout);

    while (!timeoutFlag) {
        var res = await conFunc();
        if (res) {
            return true;
        }
        else {
            await this.waitFor(interval);
        }
    }
    return false;
}

FTFixer.parseCookie = function (cookies) {
    var mutations = []; //mutation array

    for (let i in cookies) {
        // Replace %22 and %2C
        //cookieStr = cookies[i].value.split("%22").join("\"").split("%2C").join(",");
        if (cookies[i].name.slice(0, 5) != 'ftFix')
            continue;

        let cookieStr = cookies[i].value

        let mlist = JSON.parse(cookieStr);
        //console.log(cookies[i]);
        let timestamp = parseInt(cookies[i].name.slice(5)); //remove flag
        for (let j in mlist) {
            let mutation = mlist[j];
            mutation.timestamp = timestamp;
            mutations.push(mutation);
        }
    }
    return mutations;

}

FTFixer.before_cmd = async function (driver) {
    var snippet_path = __dirname + '/lib/mutationObserver.js'
    var snippet = '';
    try {
        snippet = fs.readFileSync(snippet_path, 'utf8');
    }
    catch (err) {
        console.error('Unable to open mutationObserver file at: ' + snippet_path);
        return;
    }
    await driver.executeScript(snippet);
    await driver.manage().deleteAllCookies();
}

FTFixer.before_cmd_cy = async function (cy) {
    var snippet = `StartObserver();function cookieSet(e){if("undefined"==typeof document)return;var t=(new Date).getTime(),o=JSON.stringify(e),r=new Date(Date.now()+8e3).toUTCString();cookieStr="ftFix"+t+"="+o+"; expires="+r,document.cookie=cookieStr}function StartObserver(){console.log("Start mutaion oberver");new MutationObserver((function(e,t){console.log(e);var o=[];for(let t in e){const r=e[t];let d=convertRecord(r);o.push(d),"childList"===r.type?console.log("A child node has been added or removed."):"attributes"===r.type?console.log("The "+r.attributeName+" attribute was modified."):"characterData"===r.type&&console.log("Character data was modified.")}cookieSet(o)})).observe(document,{attributes:!0,childList:!0,subtree:!0,characterData:true,attributeOldValue: true, characterDataOldValue: true}),console.log("Mutation observer started")}function convertRecord(e){var t={};t.target=convertNode(e.target),t.addedNodes=[];var o=e.addedNodes;for(let e=0;e<o.length;e++)t.addedNodes.push(convertNode(o[e]));t.removedNodes=[];var r=e.removedNodes;for(let e=0;e<r.length;e++)t.removedNodes.push(convertNode(r[e]));return t.type=e.type,t.attributeName=e.attributeName,t.oldValue=e.oldValue,t}function convertNode(e){var t={};return t.nodeName=e.nodeName,t.className=e.className,t.id=e.id,t.childElementCount=e.childElementCount,t}`;
    //var snippet = `function cookieSet(e){if("undefined"==typeof document)return;var t="ftFix"+(new Date).getTime()+"="+JSON.stringify(e)+"; expires="+new Date(Date.now()+8e3).toUTCString();document.cookie=t}function StartObserver(){if("undefined"!=typeof observer_exist&&1==observer_exist)return;console.log("Start mutaion oberver");new MutationObserver((function(e,t){var o=[];for(let t in e){const r=e[t];let n=convertRecord(r);o.push(n),"childList"===r.type?console.log("A child node has been added or removed."):"attributes"===r.type?console.log("The "+r.attributeName+" attribute was modified."):"characterData"===r.type&&console.log("Character data was modified.")}cookieSet(o)})).observe(document,{attributes:!0,childList:!0,subtree:!0}),window.observer_exist=!0,console.log("Mutation observer started")}function convertRecord(e){var t={};t.target=convertNode(e.target),t.addedNodes=[];var o=e.addedNodes;for(let e=0;e<o.length;e++)t.addedNodes.push(convertNode(o[e]));t.removedNodes=[];var r=e.removedNodes;for(let e=0;e<r.length;e++)t.removedNodes.push(convertNode(r[e]));return t.type=e.type,t.attributeName=e.attributeName,t.oldValue=e.oldValue,t}function convertNode(e){var t={};return t.nodeName=e.nodeName,t.className=e.className,t.id=e.id,t.nodeType=e.nodeType,t.nodeValue=e.nodeValue,t.textContent=e.textContent,t.childElementCount=e.childElementCount,t}StartObserver();`;
    cy.window().then((win) => {
        win.eval(snippet);
       });
    cy.clearCookies();
}

FTFixer.after_cmd = async function (driver, filename, start_line, start_col, sentence) {
    await FTFixer.waitFor(2000);
    var cookies = await driver.manage().getCookies();
    var timestamp = Date.now() - 2000; //miliseconds
    var mutations = FTFixer.parseCookie(cookies);
    
    var record = {
        "time": timestamp,
        "filename": filename,
        "start_line": start_line,
        "start_col": start_col,
        "sentence": sentence,
        "mutations": mutations
    };
    // Append to log file
    fs.appendFile(MUTATIONS_LOG_PATH, JSON.stringify(record) + '\r\n', function(err){
        if(err)
            console.error('save to log file fails.');
    })
}

FTFixer.after_cmd_cy = async function (cy, filename, start_line, start_col, sentence) {
    cy.wait(2000);
    cy.getCookies().then((cookies) => {
        var mutations = FTFixer.parseCookie(cookies);
        var timestamp = Date.now() - 2000;     
        var record = {
            "time": timestamp,
            "filename": filename,
            "start_line": start_line,
            "start_col": start_col,
            "sentence": sentence,
            "mutations": mutations
        };
        // Append to log file
        cy.readFile(MUTATIONS_LOG_PATH).then((str) => {
            cy.writeFile(MUTATIONS_LOG_PATH, str + JSON.stringify(record) + '\r\n')
        })
        
        cy.log(record)
    })
}



module.exports = FTFixer;