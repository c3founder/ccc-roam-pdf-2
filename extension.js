const panelConfig = {
    tabTitle: "CCC Roam PDF 2.0",
    settings: [
        {
            id: "highlightHeading",
            name: "Highlight heading to be printed in cousin mode.",
            description: "To switch to cousin mode, click on the button in the top right of the viewer.",
            action: {
                type: "input",
                placeholder: "**Highlights**",
                onChange: (evt) => { pdfParams.highlightHeading = evt.target.value; }
            }
        },
        {
            id: "appendHighlight",
            name: "Append or prepend highlights.",
            description: "Append: on, Prepend: off",
            action: {
                type: "switch",
                onChange: (evt) => pdfParams.appendHighlight = evt.target.checked
            }
        },
        {
            id: "pdfMinHeight",
            name: "PDF Min Height",
            description: "Min height for viewer",
            action: {
                type: "input",
                placeholder: '900',
                onChange: (evt) => { pdfParams.pdfMinHeight = evt.target.value.parseInt(); }
            }
        },
        {
            id: "citationFormat",
            name: "Citation Format",
            description: "If no input = disable, Use Citekey and page in any formating string. The page can be offset by `Page Offset` attribute. Common usecase: Zotero imports with 'roam page title' = @Citekey and Citekey attribute examples:'[${Citekey}]([[@${Citekey}]])', '[(${Citekey}, ${page})]([[@${Citekey}]])'",
            action: {
                type: "input",
                placeholder: '',
                onChange: (evt) => { pdfParams.citationFormat = evt.target.value; }
            }
        },
        {
            id: "blockQPrefix",
            name: "Block Quote Prefix",
            action: {
                type: "select",
                items: ['None', '>', '[[>]]'],
                onChange: (item) => pdfParams.blockQPrefix = item
            }
        }
    ]
};



let ccc = {};

ccc.util = ((c3u) => {
    ///////////////Front-End///////////////
    c3u.getUidOfContainingBlock = (el) => {
        return el.closest('.rm-block__input').id.slice(-9)
    }

    c3u.insertAfter = (newEl, anchor) => {
        anchor.parentElement.insertBefore(newEl, anchor.nextSibling)
    }

    c3u.getNthChildUid = (parentUid, order) => {
        const allChildren = c3u.allChildrenInfo(parentUid)[0][0].children;
        const childrenOrder = allChildren.map(function (child) { return child.order; });
        const index = childrenOrder.findIndex(el => el === order);
        return index !== -1 ? allChildren[index].uid : null;
    }

    c3u.sleep = m => new Promise(r => setTimeout(r, m))

    c3u.createPage = (pageTitle) => {
        let pageUid = c3u.createUid()
        const status = window.roamAlphaAPI.createPage(
            {
                "page":
                    { "title": pageTitle, "uid": pageUid }
            })
        return status ? pageUid : null
    }

    c3u.updateBlockString = (blockUid, newString) => {
        return window.roamAlphaAPI.updateBlock({
            block: { uid: blockUid, string: newString }
        });
    }

    c3u.hashCode = (str) => {
        let hash = 0, i, chr;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    c3u.createChildBlock = (parentUid, order, childString, childUid) => {
        return window.roamAlphaAPI.createBlock(
            {
                location: { "parent-uid": parentUid, order: order },
                block: { string: childString.toString(), uid: childUid }
            })
    }

    c3u.openBlockInSidebar = (windowType, blockUid) => {
        return window.roamAlphaAPI.ui.rightSidebar.addWindow({ window: { type: windowType, 'block-uid': blockUid } })
    }

    c3u.deletePage = (pageUid) => {
        return window.roamAlphaAPI.deletePage({ page: { uid: pageUid } });
    }


    c3u.createUid = () => {
        return roamAlphaAPI.util.generateUID();
    }



    ///////////////Back-End///////////////
    c3u.existBlockUid = (blockUid) => {
        const res = window.roamAlphaAPI.q(
            `[:find (pull ?block [:block/uid])
        :where
               [?block :block/uid \"${blockUid}\"]]`)
        return res.length ? blockUid : null
    }

    c3u.deleteBlock = (blockUid) => {
        return window.roamAlphaAPI.deleteBlock({ "block": { "uid": blockUid } });
    }

    c3u.parentBlockUid = (blockUid) => {
        const res = window.roamAlphaAPI.q(
            `[:find (pull ?parent [:block/uid])
        :where
            [?parent :block/children ?block]
               [?block :block/uid \"${blockUid}\"]]`)
        return res.length ? res[0][0].uid : null
    }

    c3u.blockString = (blockUid) => {
        return window.roamAlphaAPI.q(
            `[:find (pull ?block [:block/string])
        :where [?block :block/uid \"${blockUid}\"]]`)[0][0].string
    }

    c3u.allChildrenInfo = (blockUid) => {
        let results = window.roamAlphaAPI.q(
            `[:find (pull ?parent 
                [* {:block/children [:block/string :block/uid :block/order]}])
      :where
          [?parent :block/uid \"${blockUid}\"]]`)
        return (results.length == 0) ? undefined : results

    }

    c3u.queryAllTxtInChildren = (blockUid) => {
        return window.roamAlphaAPI.q(`[
            :find (pull ?block [
                :block/string
                {:block/children ...}
            ])
            :where [?block :block/uid \"${blockUid}\"]]`)
    }

    c3u.getPageUid = (pageTitle) => {
        const res = window.roamAlphaAPI.q(
            `[:find (pull ?page [:block/uid])
        :where [?page :node/title \"${pageTitle}\"]]`)
        return res.length ? res[0][0].uid : null
    }

    c3u.getOrCreatePageUid = (pageTitle, initString = null) => {
        let pageUid = c3u.getPageUid(pageTitle)
        if (!pageUid) {
            pageUid = c3u.createPage(pageTitle);
            if (initString)
                c3u.createChildBlock(pageUid, 0, initString, c3u.createUid());
        }
        return pageUid;
    }

    c3u.isAncestor = (a, b) => {
        const results = window.roamAlphaAPI.q(
            `[:find (pull ?root [* {:block/children [:block/uid {:block/children ...}]}])
            :where
                [?root :block/uid \"${a}\"]]`);
        if (!results.length) return false;
        let descendantUids = [];
        c3u.getUidFromNestedNodes(results[0][0], descendantUids)
        return descendantUids.includes(b);
    }

    c3u.getUidFromNestedNodes = (node, descendantUids) => {
        if (node.uid) descendantUids.push(node.uid)
        if (node.children)
            node.children.forEach(child => c3u.getUidFromNestedNodes(child, descendantUids))
    }

    return c3u;
})(ccc.util || {});

/*******************Parameter BEGIN*********************/
// const pdfParams = window.pdfParams;
/*******************Parameter END***********************/
/*******************************************************/
function setSettingDefault(extensionAPI, settingId, settingDefault) {
    let storedSetting = extensionAPI.settings.get(settingId);
    if (null == storedSetting) extensionAPI.settings.set(settingId, settingDefault);
    return storedSetting || settingDefault;
}

let pdfParams = {};
let fullScreenState = 'Half'
function mainFullScreen(props) {
    console.log(props);

    return React.createElement("iframe",
        {
            width: "100%",
            height: "100%",
            src: props.url,
            'data-pdf': props.pdf,
            'data-uid': props.uid,
            id: props.id,
            class: 'pdf-activated-full-screen',

        })
    // return (
    //     <iframe>
    //         width= "100%"
    //         height= "100%"
    //         src= {props.url},
    //         data-pdf= {props.pdf}
    //         data-uid= {props.uid}
    //         id= props.id,
    //         class= 'pdf-activated-full-screen'
    //     </iframe>
    // )

}


function onload({ extensionAPI }) {
    pdfParams.highlightHeading = setSettingDefault(extensionAPI, 'highlightHeading', '**Highlights**');
    pdfParams.appendHighlight = setSettingDefault(extensionAPI, 'appendHighlight', 'true');
    pdfParams.pdfMinHeight = setSettingDefault(extensionAPI, 'pdfMinHeight', 900);
    pdfParams.citationFormat = setSettingDefault(extensionAPI, 'citationFormat', '');
    pdfParams.blockQPrefix = setSettingDefault(extensionAPI, 'blockQPrefix', '');

    extensionAPI.settings.panel.create(panelConfig);
    roamAlphaAPI.ui.mainWindow.registerComponent("ccc-roam-pdf-2-full-screen", mainFullScreen);

    startC3Pdf2Extension();
}

let hlBtnAppearsObserver;
let onunloadfns = [];

function onunload() {
    if (hlBtnAppearsObserver) hlBtnAppearsObserver.disconnect();
    roamAlphaAPI.ui.mainWindow.unregisterComponent("ccc-roam-pdf-2-full-screen");

    for (const f of onunloadfns) {
        console.log(f);
        f();
    }
    onunloadfns = [];
}




function startC3Pdf2Extension() {
    var c3u = ccc.util;
    /*******************************************************/
    /**********************Main BEGIN***********************/
    ////////Global Consts
    // const serverPerfix = 'http://localhost:3000/?url=';
    // const serverPerfix = 'https://roampdf.web.app/?url=';
    const serverPerfix = 'https://ccc-roam-pdf.web.app/?url=';

    const HIGHLIGHTER_VERSION = '2.0';
    ////////Main function
    function initPdf() {
        Array.from(document.getElementsByTagName('iframe')).forEach(iframe => {
            if (!iframe.classList.contains('pdf-activated')) {
                try {
                    if (new URL(iframe.src).pathname.endsWith('.pdf')) {
                        iframe.dataset.pdf = iframe.src; //the permanent pdfUrl
                        iframe.id = "pdf-" + iframe.closest('.roam-block').id; //window level pdfId          
                        iframe.dataset.uid = iframe.id.slice(-9);//c3u.getUidOfContainingBlock(iframe); //for click purpose
                        renderPdf(iframe); //render pdf through the server 
                        initialHighlighSend(iframe);
                    } else if (iframe.classList.contains('pdf-activated-full-screen')) {
                        initialHighlighSend(iframe);
                        iframe.classList.add('pdf-activated')
                    }
                } catch { } // some iframes have invalid src
            }
            if (iframe.src.startsWith(serverPerfix)) {
                adjustPdfIframe(iframe);
            }
        })
        activateButtons();
        markMainHighlight();
    }
    ////////Add classlist to main highlight for making it distinct with CSS
    function markMainHighlight() {
        Array.from(document.getElementsByClassName('rm-page-ref--tag'))
            .filter(isNotVisitedPdfHighlight)
            .forEach(hl => {
                hl?.classList.add('visited-rm-page-ref-tag');
                const rootCause = hl?.closest('div[data-page-title^="roam/js/pdf/data/"]');
                if (rootCause)
                    rootCause.closest('.rm-inline-reference')?.classList.add('main-pdf-highlight');
            })
    }
    ///////////////Responsive PDF Iframe 
    function adjustPdfIframe(iframe) {
        const reactParent = iframe.closest('.react-resizable')
        const reactHandle = reactParent?.querySelector(".react-resizable-handle")
        const hoverParent = iframe.closest('.hoverparent')
        if (reactHandle)
            reactHandle.style.display = 'none';
        if (reactParent) {
            reactParent.style.width = '100%';
            reactParent.style.height = '100%';
        }
        if (hoverParent) {
            hoverParent.style.width = '100%';
            hoverParent.style.height = '100%';
        }
    }
    /************************Main END***********************/
    /*******************************************************/
    /*******************************************************/
    /**************Button Activation BEGIN******************/
    ////////////////////////////////////////////////////////
    /////Fixing HL Btns Appearance and Functions BEGIN//////
    ////////////////////////////////////////////////////////
    function activateButtons() {
        Array.from(document.getElementsByTagName('button'))
            .filter(isUnObservedHighlightBtn)
            .forEach(btn => {
                if (!btn.closest('.rm-zoom-item'))
                    hlBtnAppearsObserver.observe(btn);
                btn.classList.add('btn-observed');
            })
    }
    function activateSingleBtn(entries) {
        entries.forEach(async (entry) => {
            const btn = entry.target;
            if (isInactiveHighlightBtn(btn) && entry.intersectionRatio > .25) {
                //returns type(main or ref) and uid of the corresponding main
                const hlInfo = getHlInfoFromBtn(btn);
                if (!hlInfo.uid) {
                    await c3u.sleep(100);
                    activateSingleBtn(entries);
                    return;
                }
                const highlight = getSingleHighlightData(hlInfo.uid) //return xfdf
                let pdfInfo = getPdfInfoFromHighlight(hlInfo.uid); //return pdf url and uid
                //hide stuff  - painful
                hideBreadCrumbs(btn)
                // rm-block-ref
                const btnBlock = btn.closest(".rm-block__input");
                const btnBlockRefWrapper = btn.closest(".rm-block-ref");
                // const page = btn.innerText;
                // addBreadcrumb(btnBlock, page, pdfInfo.uid);
                pdfInfo.url = encodePdfUrl(pdfInfo.url);
                setupActionBtn(btn, btnBlockRefWrapper, pdfInfo, hlInfo, highlight);
                addColor(btnBlock);
            }
        });
    }
    let options = {
        root: document.querySelector('.roam-app'),
        rootMargin: "0px 0px 500px 0px",
        threshold: 1.0
    }
    hlBtnAppearsObserver = new IntersectionObserver(activateSingleBtn, options);
    ////////////////////////////////////////////////////////
    //////Fixing HL Btns Appearance and Functions END///////
    ////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////
    ////////////Button Activation Helper BEGIN///////////////
    /////////////////////////////////////////////////////////
    ///////////////Highlight => Retrieve PDF url and uid.
    function hideBreadCrumbs(btn) {
        let parentWindow = btn.closest(".rm-sidebar-window");
        if (parentWindow) {
            const blockRefs = parentWindow.querySelector(".window-headers").querySelector(".rm-block-ref")
            if (blockRefs) blockRefs.style.display = "none";
        }
        parentWindow = btn.closest(".main-pdf-highlight");
        if (parentWindow) {
            const caretWrapper = parentWindow.querySelector(".rm-caret-wrapper");
            if (caretWrapper) caretWrapper.style.display = "none";
            const rmZoomPath = parentWindow.querySelector(".rm-zoom-path");
            if (rmZoomPath) rmZoomPath.style.display = "none";
        }
        parentWindow = btn.closest(".roam-article");
        parentWindow = parentWindow ? parentWindow : btn.closest(".rm-sidebar-outline");
        if (parentWindow) {
            const rmZoom = parentWindow.querySelector(".rm-zoom")
            if (rmZoom) rmZoom.style.display = "none";
        }

    }
    function getPdfInfoFromHighlight(hlBlockUid) {
        const pdfDataUidUid = c3u.parentBlockUid(c3u.parentBlockUid(hlBlockUid));
        const pdfDataUrlUid = c3u.parentBlockUid(pdfDataUidUid)

        return {
            url: c3u.blockString(pdfDataUrlUid),
            uid: decodeString(c3u.blockString(pdfDataUidUid)).uid
        };
    }
    ///////////////Highlight => Highlight xfdf
    function getSingleHighlightData(hlBlockUid) {
        let hlData = c3u.blockString(c3u.parentBlockUid(hlBlockUid));
        return decodeString(hlData).xfdf;
    }
    ///////////////Get the Original Highlight
    ///////////////Where am I? Main Hilight or Reference?
    function getHlInfoFromBtn(btn) {
        let hlType, hlUid;
        const blockRefSpan = btn.closest('.rm-block-ref')
        if (!blockRefSpan) {
            hlType = 'main';
            hlUid = c3u.getUidOfContainingBlock(btn);
        } else {
            hlType = 'ref';
            hlUid = blockRefSpan.dataset.uid
            blockRefSpan.addEventListener("click", event => event.stopPropagation());
        }
        return { type: hlType, uid: hlUid };
    }
    ////////////////////Color Addition
    function addColor(btnBlock) {
        btnBlock.querySelectorAll(".rm-page-ref--tag").forEach(colorNode => {
            const match = colorNode.innerText.match(/(h|u|s|q):(.*)/);
            if (match && match[1]) { //if ref is highlight color: h:00112233 or h:yellow
                const type = match[1];
                const tag = match[2];
                if (tag[0] >= '0' && tag[0] <= '9' || tag[0] >= 'a' && tag[0] <= 'f') {//if it start with a digit => it is a hexcolor
                    if (colorNode.previousSibling.dataset.tag != type + "BrightSun") {
                        const el2change = colorNode.closest('span').parentElement.closest('span');
                        const newColor = hexToRgba(tag);
                        switch (type) {
                            case 'u': el2change.style.textDecoration = "underline " + newColor; break;
                            case 'q': el2change.style.textDecoration = "underline wavy " + newColor; break;
                            case 's': el2change.style.textDecoration = "line-through " + newColor; break;
                            default: el2change.style.backgroundColor = newColor;
                        }
                    }
                }
            }
        })
    }
    /////////////////////////////////////////////////////////
    ////////////Button Activation Helper END/////////////////
    /////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////
    //////////////Action Button Setup BEGIN//////////////////
    /////////////////////////////////////////////////////////
    function setupActionBtn(btn, btnBlockRefWrapper, pdfInfo, hlInfo, highlight) {
        const btnBlockUid = c3u.getUidOfContainingBlock(btn);
        if (hlInfo.type === 'ref')
            btnBlockRefWrapper.classList.add('has-annotation');
        const extraClass = 'btn-' + hlInfo.type + '-annotation'
        const spanRoot = btn.closest('span').parentElement.closest('span')
        spanRoot.querySelectorAll('button').forEach(abtn => {
            abtn.classList.add(extraClass, 'btn', 'btn-default', 'btn-pdf-activated');
            switch (abtn.innerText) {
                case '📋':
                    abtn.classList.add('btn-rep-text');
                    abtn.addEventListener("click", (e) => { replaceWithText(e, btnBlockUid, hlInfo) });
                    break;
                case '❌':
                    abtn.classList.add('btn-delete');
                    abtn.addEventListener("click", (e) => { deleteHighlight(e, pdfInfo, btnBlockUid, hlInfo) });
                    break;
                case '💬':
                    abtn.classList.add('btn-comment');
                    abtn.addEventListener("click", (e) => { commentHighlight(e, pdfInfo, highlight, btnBlockUid, hlInfo) });
                    break;
                default:
                    abtn.classList.add('btn-scrollto');
                    abtn.addEventListener("click", (e) => { jumpToHighlight(e, pdfInfo, highlight, hlInfo) });
            }
        })
    }
    function replaceWithText(e, btnBlockUid, hlInfo) {
        const { uid: hlBlockUid, type } = hlInfo
        //Prepare the substitute string
        if (type === 'ref') {
            let hl = c3u.blockString(hlBlockUid);
            const colorText = hl.match(/\#(h|u|s|q):.*#(h|u|s|q):(........)\#\[\[c3-pdf-highlight\]\]/)
            hl = hl.substring(colorText[0].length)
            // const match = hl.match(/\{\{\d+:\s*.........\}\}\{\{.\}\}\{\{.\}\}\s*\[..?\]\(\(\(.........\)\)\)/)
            // const match = hl.match(/\{\{\d+:\s*.........\}\}\{\{.\}\}\{\{.\}\}\s*/)
            const match = hl.match(/\{\{\d\}\}\{\{📋\}\}\{\{❌\}\}\{\{💬\}\}\s*/)

            const hlText = hl.substring(0, match.index);
            // const hlAlias = hlText + "[*](((" + hlBlockUid + ")))";

            //Search for all instances of the block ref and replace them with text
            const blockTxt = c3u.blockString(btnBlockUid);
            let newBlockTxt;
            let re = new RegExp("#(h|u|s|q):\\w*\\(\\(" + hlBlockUid + "\\)\\)", 'gm');

            newBlockTxt = blockTxt.replace(re, hlText)
            // else
            // newBlockTxt = blockTxt.replace(re, hlAlias)

            c3u.updateBlockString(btnBlockUid, newBlockTxt)
        }
    }
    function deleteHighlighMention(btnBlockUid, hlBlockUid) {
        let refBlockTxt = c3u.blockString(btnBlockUid);
        let re = new RegExp("#(h|u|s|q):\\w*\\(\\(" + hlBlockUid + "\\)\\)", 'gm');
        let newBlockTxt = refBlockTxt.replace(re, '')
        if (newBlockTxt == '')
            c3u.deleteBlock(btnBlockUid)
        else
            c3u.updateBlockString(btnBlockUid, newBlockTxt)
    }
    async function deleteHighlight(e, pdfInfo, btnBlockUid, hlInfo) {
        const { uid: hlBlockUid, type } = hlInfo
        //delete all highlight block refs
        getBlockUidsReferencingBlock(hlBlockUid).forEach(blockUid => deleteHighlighMention(blockUid, hlBlockUid))
        //figure out data to delete
        const toDeleteHlData = c3u.parentBlockUid(hlBlockUid);
        const toDeleteHighlightId = decodeString(c3u.blockString(toDeleteHlData)).id
        const iframe = getFirstOpenIframeInstance(pdfInfo)
        sendMessageToViewer([toDeleteHighlightId], 'delete', iframe)
        //the rest of open iframes should delete the highlight through the pullwatch
        //delete the highlight data alltogether
        await c3u.sleep(100)
        c3u.deleteBlock(toDeleteHlData)
    }
    async function commentHighlight(e, pdfInfo, highlight, btnBlockUid, hlInfo) {
        const { uid: hlBlockUid, type } = hlInfo
        if (type === 'main') {//if this is the main highlight commit the comments
            const commentsInfo = c3u.allChildrenInfo(hlBlockUid)[0][0]?.children;
            let toSendData = {};
            const toReplyToHlData = c3u.parentBlockUid(hlBlockUid);
            const toReplyToHighlightId = decodeString(c3u.blockString(toReplyToHlData)).id
            toSendData['repliedToId'] = toReplyToHighlightId
            const iframe = await getOrOpenIframeInstance(pdfInfo);
            if (commentsInfo) { //if there are comments..
                let children = [];
                commentsInfo.map(child => {
                    child.editor = getLastEditedUser(child.uid)
                    children[child.order] = { uid: child.uid, content: child.string, editor: child.editor };
                });
                toSendData['comment'] = children[0];
                toSendData['replies'] = children.slice(1);
            } else { //if no comments: delete everything
                toSendData['comment'] = '';
                toSendData['replies'] = [];
            }
            sendMessageToViewer(toSendData, 'comments', iframe)
            sendMessageToViewer([highlight], 'scrollTo', iframe)
        } else { //if this is a block ref: open the main highlight
            c3u.openBlockInSidebar('block', hlBlockUid)
            await c3u.sleep(100)
            const allWindows = window.roamAlphaAPI.ui.rightSidebar.getWindows()
            await c3u.sleep(100)
            const commentsInfo = c3u.allChildrenInfo(hlBlockUid)[0][0]?.children;
            await c3u.sleep(100)
            let commentUid;
            if (!commentsInfo) {
                commentUid = c3u.createUid();
                c3u.createChildBlock(hlBlockUid, 0, ' ', commentUid);
            } else {
                commentUid = commentsInfo[0].uid;
            }
            await c3u.sleep(100)
            window.roamAlphaAPI.ui.setBlockFocusAndSelection(
                { location: { "window-id": allWindows[0]['window-id'], "block-uid": commentUid } }
            );
        }
    }
    async function jumpToHighlight(e, pdfInfo, highlight, hlInfo) {
        const { uid: hlBlockUid, type } = hlInfo
        //Prepare the substitute string
        if (type === 'ref')
            e.stopPropagation();
        const iframe = await getOrOpenIframeInstance(pdfInfo);
        sendMessageToViewer([highlight], 'scrollTo', iframe)
    }
    //////////////////////////////////////////////////////////
    //////////////Action Button Setup END/////////////////////
    //////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////
    ////////////////Action Buttons Helper BEGIN///////////////
    ////////////////////////////////////////////////////////// 
    function sendMessageToViewer(focusHighlight, action, iframe) {
        const dataBlockString = action == 'init' ?
            {
                dataUid: iframe.dataBlockUid,
                ...decodeString(c3u.blockString(iframe.dataBlockUid))
            }
            : null;
        iframe?.contentWindow.postMessage({
            highlights: focusHighlight, actionType: action, iframeId: iframe.id,
            dataBlockStr: dataBlockString, isFullScreen: iframe.classList.contains('pdf-activated-full-screen'),
            userName: getCurrentUserDisplayName()
        }, '*');
    }
    async function getOrOpenIframeInstance(pdfInfo) {
        let iframe = getFirstOpenIframeInstance(pdfInfo);
        if (!iframe) { //Iframe is closed      
            c3u.openBlockInSidebar('block', pdfInfo.uid)
            await c3u.sleep(5000);
        }
        //let the app starts
        iframe = getFirstOpenIframeInstance(pdfInfo);
        return iframe;
    }
    function getFirstOpenIframeInstance(pdfInfo) {
        return Array.from(document.getElementsByTagName('iframe'))
            .find(iframe => iframe.src === pdfInfo.url &&
                iframe.id.slice(-9) === pdfInfo.uid
            );
        // .find(iframe => iframe.src === pdfInfo.url &&
        //     c3u.getUidOfContainingBlock(iframe) === pdfInfo.uid
        // );
    }

    ////////////////////Search the sub-tree of HL/PDF's 
    ////////////////////shared parents for the meta info
    function findPDFAttribute(pdfUid, attribute) {
        let gParentRef;
        if (pdfParams.outputHighlighAt === 'cousin') {
            gParentRef = c3u.parentBlockUid(c3u.parentBlockUid(pdfUid));
            if (!gParentRef) gParentRef = pdfUid;
        }
        else //child mode
            gParentRef = pdfUid; //parentBlockUid(pdfUid);

        let ancestorrule = `[ 
                       [ (ancestor ?b ?a) 
                            [?a :block/children ?b] ] 
                       [ (ancestor ?b ?a) 
                            [?parent :block/children ?b ] 
                            (ancestor ?parent ?a) ] ] ]`;

        const res = window.roamAlphaAPI.q(
            `[:find (pull ?block [:block/string])
          :in $ %
          :where
              [?block :block/string ?attr]
              [(clojure.string/starts-with? ?attr \"${attribute}:\")]
              (ancestor ?block ?gblock)
                 [?gblock :block/uid \"${gParentRef}\"]]`, ancestorrule)
        if (!res.length) return ' ';
        // match attribute: or attribute::
        const attrMatch = new RegExp(`^${attribute}::?\\s*(.*)$`);
        return res[0][0].string.match(attrMatch)[1];
    }
    /////////////////////////////////////////////////////////
    ////////////////Action Buttons Helper END////////////////
    /////////////////////////////////////////////////////////
    /***************Button Activation END*******************/
    /*******************************************************/
    /*******************************************************/
    /***********Handle Received Messages BEGIN**************/
    window.addEventListener('message', handleRecievedMessage, false);
    onunloadfns.push(() => window.removeEventListener('message', handleRecievedMessage));
    ///////////Recieve Highlight Data, Output Highlight Text, Store HL Data 
    async function handleRecievedMessage(event) {
        // console.log("in roam: handling messege")
        // console.log(event.data.actionType)
        let isNew;
        const extracted = await extractMessageInfo(event);
        const { actionType } = extracted;
        switch (actionType) {
            case 'add':
                await handleNewHighlight(event, extracted, isNew = true)
                break;
            case 'modify':
                await handleNewHighlight(event, extracted, isNew = false)
                break;
            case 'delete':
                handleDeletedHighlight(event, extracted)
                break;
            case 'openHlBlock':
                handleOpenHighlight(event, extracted)
                break;
            case 'copyRef':
                handleCopyHighlightRef(event, extracted)
                break;
            case 'viewVersions':
                handleShowVersionList(event, extracted)
                break;
            case 'renameVersion':
                handleRenameThisVersion(event, extracted)
                break;
            case 'showThisVersion':
                handleShowThisVersion(event, extracted)
                break;
            case 'showOriginal':
                handleShowOriginalVersion(event, extracted)
                break;
            case 'importCompleted':
                handleImported(event, extracted)
                break;
            case 'toggleFullScreen':
                handleToggleFullScreen(event, extracted)
                break;
        }
    }
    /////////////////////////////////////////////////////////
    //////////////////All Handlers BEGIN///////////////////

    function handleToggleFullScreen(event, extracted) {
        const { iframe, fullScreen } = extracted;
        fullScreenState = fullScreen
        if (fullScreenState == 'Full') { //switch from half to full
            roamAlphaAPI.ui.mainWindow.openComponent("ccc-roam-pdf-2-full-screen", {
                url: iframe.src,
                id: iframe.id,
                uid: iframe.id.slice(-9),
                pdf: decodePdfUrl(iframe.src),
            });
        } else {
            roamAlphaAPI.ui.mainWindow.closeComponent("ccc-roam-pdf-2-full-screen");
        }
    }
    function handleImported(event, extracted) {
        const { iframe } = extracted;
        const iframeData = decodeString(c3u.blockString(iframe.dataBlockUid));
        iframeData.alreadyImported = true;
        c3u.updateBlockString(iframe.dataBlockUid, encodeString(JSON.stringify(iframeData)));
    }

    function handleShowOriginalVersion(event, extracted) {
        const { iframe } = extracted;
        const toSendXfdf = getVersionToShowXfdf(extracted)
        sendMessageToViewer(toSendXfdf, 'add', iframe)
    }

    function handleShowThisVersion(event, extracted) {
        const { iframe } = extracted;
        const toSendXfdf = getVersionToShowXfdf(extracted)
        sendMessageToViewer(toSendXfdf, 'showVersion', iframe)
    }

    function handleRenameThisVersion(event, extracted) {
        const { versionNewName, iframe } = extracted;
        const iframeData = decodeString(c3u.blockString(iframe.dataBlockUid));
        iframeData.versionName = versionNewName;
        c3u.updateBlockString(iframe.dataBlockUid, encodeString(JSON.stringify(iframeData)));
    }

    function handleShowVersionList(event, extracted) {
        const { iframe } = extracted;
        const versionsMeta = getAllHighligtVersions(iframe.dataPageUid)
        sendMessageToViewer(versionsMeta, 'showVersionList', iframe)
    }

    async function handleCopyHighlightRef(event, extracted) {
        const { hexcolor, annotType, hlTextUid } = extracted;
        const { namedColorTag } = hexToNamedColorTag(hexcolor, annotType)
        navigator.clipboard.writeText(namedColorTag + "((" + hlTextUid + "))");
    }

    async function handleOpenHighlight(event, extracted) {
        // const { iframe, hlTextUid } = await extractHighlightFromMessage(event);
        // const pdfBlockUid = iframe.dataset.uid;
        // let hlRefParentBlockUid;
        // const hlQuery = "{{[[query]]: {and: ((" + hlTextUid + ")) {not: [[c3-pdf-highlight]]}}}}";

        // if (pdfParams.outputHighlighAt === 'cousin') {
        //     hlRefParentBlockUid = getUncleBlock(pdfBlockUid);
        //     await c3u.sleep(100);
        //     if (!hlRefParentBlockUid) hlRefParentBlockUid = pdfBlockUid; //there is no gparent, write hl as a child
        // } else { //outputHighlighAt ==='child'
        //     hlRefParentBlockUid = pdfBlockUid
        // }
        const { hlTextUid } = extracted;
        window.roamAlphaAPI.ui.rightSidebar.addWindow({
            window:
                { type: 'mentions', 'block-uid': hlTextUid }
        })
        //make the query block and open it
        // let ord = (pdfParams.appendHighlight) ? 'last' : 0;
        // const queryBlockUid = c3u.createUid();
        // c3u.createChildBlock(hlRefParentBlockUid, ord, hlQuery, queryBlockUid);
        // c3u.openBlockInSidebar('block', queryBlockUid)
        // c3u.sleep(30) //prevent multiple block opening.
    }

    async function handleNewHighlight(event, extracted, isNew) {
        const { iframe, hlId, hlTime, hlDataUid, annotType, fromRoam } = extracted;
        //highlight time state should get updated before save/write (which call the pullWatch)
        let timeEntries = iframeHighlightTimes[iframe.id]
        timeEntries = timeEntries ? timeEntries : {};
        timeEntries[hlDataUid] = { id: hlId, time: hlTime }
        saveHighlightData(extracted, isNew);
        const needText = ['Rectangle', 'Highlight', 'Underline', 'Strikeout', 'Squiggly', 'Note'];
        if (needText.includes(annotType) && !fromRoam)
            await writeHighlightText(extracted, isNew);
    }

    async function handleDeletedHighlight(event, extracted) {
        const { iframe, hlTextUid, hlDataUid, fromRoam } = extracted;
        if (!fromRoam) {
            getBlockUidsReferencingBlock(hlTextUid).forEach(blockUid => deleteHighlighMention(blockUid, hlTextUid))
            await c3u.sleep(100)
            c3u.deleteBlock(hlTextUid)
        }
        //highlight time state should get updated before save/write (which call the pullWatch)
        const timeEntries = iframeHighlightTimes[iframe.id]
        delete timeEntries[hlDataUid]
        c3u.deleteBlock(hlDataUid)
    }
    //////////////////All Handlers END///////////////////////
    /////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////
    //////////////Helpers of Handlers BEGIN//////////////////
    ////////////Extract all parts of the message to variables
    async function extractMessageInfo(event) {
        const page = event.data?.annotation?.pageNumber;
        let hexcolor = event.data?.annotation?.color;
        if (!hexcolor) hexcolor = "ffffffff"
        const hlData = encodeString(JSON.stringify(event.data?.annotation));
        const hlTime = event.data?.annotation?.time;
        const hlId = event.data?.annotation?.id;
        const fromRoam = event.data?.fromRoam == 'true' ? true : false;
        const printBehavior = event.data?.printBehavior;
        const copyBehavior = event.data?.copyBehavior;
        const versionNewName = event.data?.versionNewName;
        const versionToShow = event.data?.versionToShow;
        const fullScreen = event.data?.fullScreen;

        // const isReply = event.data.annotation.isReply;
        const repliedToTextUid = event.data?.annotation?.repliedToTextUid
        const commentTextUid = event.data?.annotation?.commentTextUid
        const content = event.data?.annotation?.content;
        const textBlockExist = event.data?.annotation?.textBlockExist;

        const iframe = document.getElementById(event.data.iframeId)
        let hlValue = "";
        // const pdfAlias = `[${pdfChar}](((${iframe.dataset.uid})))`;
        const hlDataUid = event.data?.annotation?.dataUid;
        const hlTextUid = event.data?.annotation?.textUid;
        // const hlBtn = `{{${page}: ${hlDataUid}}}`;
        const hlBtn = `{{${page}}}`;
        const annotType = event.data?.annotation?.annotType;
        const actionType = event.data.actionType
        const needAction = ['add', 'modify', 'delete'];
        if (needAction.includes(actionType)) {
            if (annotType == 'Rectangle') { //area highlight
                const imgFile = await srcToFile(event.data.image, 'areahl.png', 'image/png');
                hlValue = await roamAlphaAPI.util.uploadFile({ file: imgFile });
            }
            else if (event.data?.annotation?.text) {
                hlValue = `${event.data?.annotation.text}`;
                hlValue = hlValue.replace(/(\r\n|\n|\r)/gm, " ");
                hlValue = hlValue.replace(/- /gm, '');
            }
        }
        return {
            iframe, hlId, hlValue, hlData, hlTextUid, hlDataUid, hlTime,
            annotType, textBlockExist, page, hexcolor, hlBtn,
            repliedToTextUid, commentTextUid, content, actionType, fromRoam,
            printBehavior, copyBehavior, versionNewName, versionToShow, fullScreen
        }
    }
    function getVersionToShowXfdf(extracted) {
        const { versionToShow } = extracted;
        let hlsData = c3u.allChildrenInfo(versionToShow)[0][0].children;
        let toSendXfdf = [];
        if (hlsData) {
            const highlights = hlsData.map(x => decodeString(x.string));
            highlights.forEach(hl => {
                toSendXfdf.push(hl.xfdf);
            })
        }
        return toSendXfdf;
    }
    function getAllHighligtVersions(dataPageUid) {
        const versionsMeta = {}
        const allPdfUrls = c3u.allChildrenInfo(dataPageUid)[0][0].children.slice(1);
        allPdfUrls.map(pdfurl => {
            const allPdfData = c3u.allChildrenInfo(pdfurl.uid)[0][0].children;
            // `{{${iframe.dataset.uid}}}{{1}}{{}}`
            allPdfData.map(pdfData => {
                const pdfMeta = decodeString(pdfData.string);
                versionsMeta[pdfData.uid] = pdfMeta
            })
        });
        return versionsMeta;
    }
    ////////////Fetch a source and make a new file out of it
    ////////////Mostly for saving image files in roam
    function srcToFile(src, fileName, mimeType) {
        return (fetch(src)
            .then(function (res) { return res.arrayBuffer(); })
            .then(function (buf) { return new File([buf], fileName, { type: mimeType }); })
        );
    }
    ////////////Adds tags, buttons, etc. to hlText
    function prepareHighlightText(extracted) {
        const { iframe, hlValue, annotType, page, hexcolor, hlBtn, pdfAlias } = extracted;
        const pdfBlockUid = iframe.id;
        //Make the citation
        const perfix = (pdfParams.blockQPrefix === 'None') ? '' : pdfParams.blockQPrefix + ' ';
        let Citekey = '';
        if (pdfParams.citationFormat !== '') {
            if (!pdf2citeKey[pdfBlockUid]) {
                pdf2citeKey[pdfBlockUid] = findPDFAttribute(pdfBlockUid, "Citekey")
            }
            if (!pdf2pgOffset[pdfBlockUid]) {
                const tempOffset = parseInt(findPDFAttribute(pdfBlockUid, "Page Offset"));
                pdf2pgOffset[pdfBlockUid] = isNaN(tempOffset) ? 0 : tempOffset;
            }
            Citekey = pdf2citeKey[pdfBlockUid];
            page = page - pdf2pgOffset[pdfBlockUid];
        }
        const citation = eval('`' + pdfParams.citationFormat + '`').replace(/\s+/g, '');
        const { cssChar, namedColorTag } = hexToNamedColorTag(hexcolor, annotType);
        const actionBtns = `{{📋}}{{❌}}{{💬}}`;
        const c3Tag = '#[[c3-pdf-highlight]]';
        // ${pdfAlias}
        const hlText = `${perfix}${namedColorTag}${cssChar}:${hexcolor}${c3Tag} ${hlValue}${citation} ${hlBtn}${actionBtns}`;
        return { namedColorTag, hlText };
    }
    ////////////Make the named color tag for highlight refs
    function hexToNamedColorTag(hexcolor, annotType) {
        const namedcolor = ntc.name("#" + hexcolor.slice(0, 6))[1].replace(/\s/g, '');; //remove alpha and name the color   
        let cssChar = ''
        switch (annotType) {
            case 'Underline': cssChar = '#u'; break;
            case 'Strikeout': cssChar = '#s'; break;
            case 'Squiggly': cssChar = '#q'; break;
            default: cssChar = '#h';
        }
        const namedColorTag = `${cssChar}:${namedcolor}`
        return { cssChar, namedColorTag };
    }
    ///////////For the Cousin Output Mode: Find the Uncle of the PDF Block. 
    function getUncleBlock(pdfBlockUid) {
        const pdfParentBlockUid = c3u.parentBlockUid(pdfBlockUid);
        const gParentBlockUid = c3u.parentBlockUid(pdfParentBlockUid);
        let dictUid2Ord = {};
        let dictOrd2Uid = {};
        if (!gParentBlockUid) return null;
        const mainBlocksUid = c3u.allChildrenInfo(gParentBlockUid);
        mainBlocksUid[0][0].children.map(child => {
            dictUid2Ord[child.uid] = child.order;
            dictOrd2Uid[child.order] = child.uid;
        });
        //Single assumption: PDF & Highlights are assumed to be siblings.
        let hlParentBlockUid = dictOrd2Uid[dictUid2Ord[pdfParentBlockUid] + 1];
        if (!hlParentBlockUid) {
            hlParentBlockUid = c3u.createUid()
            c3u.createChildBlock(gParentBlockUid, dictUid2Ord[pdfParentBlockUid] + 1,
                pdfParams.highlightHeading, hlParentBlockUid);
        }
        return hlParentBlockUid;
    }
    ////////////Write the Highlight Text Using the Given Format
    let pdf2citeKey = {}
    let pdf2pgOffset = {}
    async function writeHighlightText(extracted, isNew) {
        const { iframe, hlTextUid, repliedToTextUid, commentTextUid, content, printBehavior, copyBehavior } = extracted;
        //update the comment first 
        if (commentTextUid) c3u.updateBlockString(commentTextUid, content);
        const { namedColorTag, hlText } = prepareHighlightText(extracted);
        //this is a reply or original comment use the plain text of comment
        const updatedText = repliedToTextUid ? content : hlText
        c3u.updateBlockString(hlTextUid, updatedText);
        let taggedBlockRef = namedColorTag + "((" + hlTextUid + "))";

        if (isNew && !repliedToTextUid && printBehavior != 'Nothing') { //if this is a reply [or comment - bc comments are not new] do not output it
            let hlRefParentBlockUid;
            //Find where to write
            if (printBehavior === 'Cousin') {
                hlRefParentBlockUid = getUncleBlock(iframe.dataset.uid);
                await c3u.sleep(100);
                if (!hlRefParentBlockUid) hlRefParentBlockUid = iframe.dataset.uid; //there is no gparent, write hl as a child
            } else { //printBehavior ==='Child'
                hlRefParentBlockUid = iframe.dataset.uid
            }
            let ord = (pdfParams.appendHighlight) ? 'last' : 0;
            c3u.createChildBlock(hlRefParentBlockUid, ord, taggedBlockRef, c3u.createUid());
        } else { //update color of every block ref
            getBlockUidsReferencingBlock(hlTextUid).forEach(blockUid => {
                let refBlockTxt = c3u.blockString(blockUid);
                let re = new RegExp("#(h|u|s|q):\\w*\\(\\(" + hlTextUid + "\\)\\)", 'gm');
                let newBlockTxt = refBlockTxt.replace(re, taggedBlockRef)
                c3u.updateBlockString(blockUid, newBlockTxt)
            })
        }
        //What to put in clipboard
        if (copyBehavior == 'BlockRef')
            navigator.clipboard.writeText(taggedBlockRef);
        else if (copyBehavior == 'Pin')
            navigator.clipboard.writeText(`[📌](((${hlTextUid})))`);
    }
    ///////////Create the required block structure for the data page
    async function saveHighlightData(extracted, isNew) {
        const { iframe, hlData, hlTextUid, hlDataUid, repliedToTextUid, commentTextUid, textBlockExist } = extracted;
        if (!isNew) {//modified annotation
            c3u.updateBlockString(hlDataUid, hlData)
            if (commentTextUid && !c3u.existBlockUid(commentTextUid)) {//first time comment
                c3u.createChildBlock(hlTextUid, 0, '', commentTextUid);
            }
        } else { //new annotation
            const dataRootUid = iframe.dataBlockUid; //await getDataRootUid(iframe);
            c3u.createChildBlock(dataRootUid, 'last', hlData, hlDataUid);
            if (!textBlockExist) { //it is a new highlight or a reply that is initiated in the viewer
                if (repliedToTextUid) {
                    c3u.createChildBlock(repliedToTextUid, 'last', '', hlTextUid); //reply
                } else {
                    c3u.createChildBlock(hlDataUid, 0, '', hlTextUid); //main annotation text
                }
            }
        }
    }
    ///////////////Helpers of Handlers END////////////////////
    /////////////////////////////////////////////////////////
    /************Handle Received Messages END***************/
    /*******************************************************/

    /*******************************************************/
    /**********Render PDF and Highlights BEGIN**************/
    /////////////////////Find pdf iframe being highlighted

    /////////////////////Show the PDF through the Server
    function renderPdf(iframe) {
        iframe.classList.add('pdf-activated');
        iframe.src = encodePdfUrl(iframe.src);
        iframe.style.minWidth = `${pdfParams.pdfMinWidth}px`;
        iframe.style.minHeight = `${pdfParams.pdfMinHeight}px`;
    }

    let iframeHighlightTimes = {};
    /////////////////////Send Old Saved Highlights to Server to Render
    async function initialHighlighSend(iframe) {
        console.log('inside init')
        await getDataRootUid(iframe);
        console.log('dataroot done')
        let hlsData = c3u.allChildrenInfo(iframe.dataBlockUid)[0][0].children;
        let toSendXfdf = [];
        let toKeepTime = {};

        if (hlsData) {
            const highlights = hlsData.map(x => decodeString(x.string));
            highlights.forEach(hl => {
                toSendXfdf.push(hl.xfdf);
                toKeepTime[hl.dataUid] = { id: hl.id, time: new Date(hl.time) };//{uid: {time, hlId}}
            })
        }
        iframeHighlightTimes[iframe.id] = toKeepTime;
        const delay = fullScreenState == 'Half' ? 7000 : 7000
        window.setTimeout(() => sendMessageToViewer(toSendXfdf, 'init', iframe), delay);
        //pullWatch should be added to iframe.dataBlockUid
        //If data block of this iframe changed call syncHighlights()   
        window.roamAlphaAPI.data.addPullWatch(
            '[:block/children :block/string {:block/children ...}]',
            `[:block/uid \"${iframe.dataBlockUid}\"]`,
            function a(before, after) { syncHighlights(before, after, iframe.id) });
    }

    function syncHighlights(before, after, iframeId) {
        const iframe = document.getElementById(iframeId);
        const hlsDataNew = after[':block/children']
        const highlights = hlsDataNew?.map(x => decodeString(x[':block/string']));
        let newTime = [];
        // highlights?.forEach(hl => newTime[hl.dataUid] = hl.date);
        highlights?.forEach(hl => newTime[hl.dataUid] = { id: hl.id, time: new Date(hl.time) });

        let oldTime = iframeHighlightTimes[iframeId];
        let addedList = [];
        let deletedList = []; //just ids
        let modifiedList = [];
        Object.keys(newTime).forEach(newUid => {//add
            if (!(newUid in oldTime)) {
                addedList.push(decodeString(c3u.blockString(newUid)).xfdf);
                oldTime[newUid] = newTime[newUid];
            }
        });
        if (addedList.length > 0) sendMessageToViewer(addedList, 'add', iframe);

        Object.keys(oldTime).forEach(oldUid => {//delete
            if (!(oldUid in newTime)) {
                deletedList.push(oldTime[oldUid].id);
                delete oldTime[oldUid]
            }
        });
        if (deletedList.length > 0) sendMessageToViewer(deletedList, 'delete', iframe);

        Object.keys(newTime).forEach(newUid => {//modify
            Object.keys(oldTime).forEach(oldUid => {
                if (oldUid == newUid && oldTime[oldUid].time < newTime[newUid].time) {
                    modifiedList.push(decodeString(c3u.blockString(newUid)).xfdf)
                    oldTime[oldUid].time = newTime[newUid].time
                }
            })
        });
        if (modifiedList.length > 0) sendMessageToViewer(modifiedList, 'modify', iframe);
    }

    // Only called once when we are sending highlight to the App
    async function getDataRootUid(iframe) {
        const dataPageTitle = await getDataPageTitle(iframe);
        let dataPage = { pageUid: null, urlUid: null, blockUid: null };
        dataPage.pageUid = c3u.getPageUid(dataPageTitle);
        if (!dataPage.pageUid) { //If this is the first time uploading the pdf
            dataPage = await createDataPage(dataPageTitle, iframe, true);
            await c3u.sleep(100);
        }
        else {
            //first find the pdfurl (should always exist  atp)
            let res = c3u.allChildrenInfo(dataPage.pageUid)[0][0];
            const urlBlocks = res.children.filter(child => child.string == iframe.dataset.pdf)
            if (urlBlocks.length == 0)
                dataPage = await createDataPage(dataPageTitle, iframe, false);
            else
                dataPage.urlUid = urlBlocks[0].uid;
            //next see if this pdf was on this block before
            res = c3u.allChildrenInfo(dataPage.urlUid)[0][0];
            if (res.children)
                dataPage.blockUid = res.children.filter(child => decodeString(child.string).uid == iframe.dataset.uid)[0]?.uid;
            if (!dataPage.blockUid) { //first time this pdf is read on this block
                dataPage.blockUid = c3u.createUid();
                //{{${iframe.dataset.uid}}}{{1}}{{ }}{{0}}
                const iframeData = { uid: iframe.dataset.uid, resumePage: 1, versionName: ' ', alreadyImported: false }
                c3u.createChildBlock(dataPage.urlUid, 'last', encodeString(JSON.stringify(iframeData)), dataPage.blockUid)
            }
        }
        iframe.dataPageUid = dataPage.pageUid;
        iframe.dataUrlUid = dataPage.urlUid;
        iframe.dataBlockUid = dataPage.blockUid;
        // return dataPage.blockUid;
    }

    async function getDataPageTitle(iframe) {
        const universalPdfId = await fingerprint(iframe.dataset.pdf, 1024);
        return 'roam/js/pdf/data/' + universalPdfId;
    }
    /////////////////////Initialize a Data Page. Format is:
    async function createDataPage(pageTitle, iframe, newPage) {
        let pageUid;
        if (newPage) {
            pageUid = c3u.createPage(pageTitle);
            c3u.createChildBlock(pageUid, 0, 'Version: ' + HIGHLIGHTER_VERSION, c3u.createUid());
        } else {
            pageUid = c3u.getPageUid(pageTitle); //TODO: put this in the c3u utility
        }
        const urlUid = c3u.createUid();
        c3u.createChildBlock(pageUid, 'last', iframe.dataset.pdf, urlUid);
        const blockUid = c3u.createUid();
        const iframeData = { uid: iframe.dataset.uid, resumePage: 1, versionName: ' ', alreadyImported: false }
        c3u.createChildBlock(urlUid, 0, encodeString(JSON.stringify(iframeData)), blockUid);
        await c3u.sleep(500);
        return { pageUid, urlUid, blockUid };
    }
    /***********Render PDF and Highlights END***************/
    /*******************************************************/
    /*******************************************************/
    /***************Helper Functions BEGIN******************/
    /////////////////////////////////////////////////////////
    ////////////Gather Buttons Information BEGIN/////////////
    function isRoamBtn(btn) {
        return btn.classList.contains('block-ref-count-button')
            || btn.classList.contains('bp3-minimal')
    }

    function isInactive(btn) {
        return !btn.classList.contains('btn-pdf-activated');
    }

    function isUnObserved(btn) {
        return !btn.classList.contains('btn-observed');
    }

    function isNotVisitedPdfHighlight(span) {
        return span?.dataset?.tag && span.dataset.tag == 'c3-pdf-highlight'
            && !span?.classList.contains('visited-rm-page-ref-tag')
    }

    function isHighlightBtn(btn) {
        return !isRoamBtn(btn)
            && btn.innerText.match(/^\d+$/)
    }

    function isInactiveHighlightBtn(btn) {
        return isHighlightBtn(btn) && isInactive(btn)
    }

    function isUnObservedHighlightBtn(btn) {
        return isHighlightBtn(btn) && isUnObserved(btn)
    }
    ////////////Gather Buttons Information END///////////////
    /////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////
    ////////////////Roam API Wrappers BEGIN/////////////////
    function getLastEditedUser(blockUid) {
        const userInfo = window.roamAlphaAPI.pull(
            "[{:edit/user [{:user/display-page [:node/title]}]}]",
            [":block/uid", `${blockUid}`]);
        return userInfo[':edit/user'][':user/display-page'][':node/title']
    }

    function getCurrentUser() {
        let globalAppState = JSON.parse(localStorage.getItem("globalAppState") || '["","",[]]');
        let userIndex = globalAppState.findIndex(function (s) { return s === "~:user"; });
        if (userIndex > 0) {
            return globalAppState[userIndex + 1];
        }
        return [];
    };

    function getCurrentUserDisplayName() {
        let userArray = getCurrentUser();
        let uidIndex = userArray.findIndex(function (s) { return s === "~:display-name"; });
        if (uidIndex > 0) {
            return userArray[uidIndex + 1] || "";
        }
        return "";
    };

    function getBlockUidsReferencingBlock(uid) {
        return window.roamAlphaAPI
            .q("[:find ?u :where [?r :block/uid ?u] [?r :block/refs ?b] [?b :block/uid \"".concat(uid, "\"]]"))
            .map(function (s) { return s[0]; });
    };

    function getPageUidByBlockUid(blockUid) {
        let _a, _b, _c;
        return ((_c = (_b = (_a = window.roamAlphaAPI.q("[:find (pull ?p [:block/uid]) :where [?e :block/uid \"".concat(blockUid, "\"] [?e :block/page ?p]]"))) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.uid) || "";
    };
    /////////////////Roam API Wrappers END///////////////////
    /////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////
    ////////////////For Fingerprinting BEGIN/////////////////
    //Fetches a file and return it as an arrayBuffer
    function srcToBite(src) {
        return (fetch(src)
            .then(function (res) { return res.arrayBuffer(8) })
        );
    }
    //Generate MD5 hash code of the first 1k of the pdf file
    async function fingerprint(pdfUrl, size) {
        const pdfBytes = await srcToBite(pdfUrl)
        const biteSize = pdfBytes.size < size ? pdfBytes.size : size
        const hash = calculateMD5(new Uint8Array(pdfBytes.slice(0, biteSize)), 0, biteSize);
        let fileID = "";
        for (let i = 0, n = hash.length; i < n; i++) {
            let hex = hash[i].toString(16);
            fileID += hex.length === 1 ? '0' + hex : hex;
        }
        return fileID;
    }
    ////////////////For Fingerprinting END///////////////////
    /////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////
    //////////////////////Others BEGIN///////////////////////
    function encodePdfUrl(url) {
        return serverPerfix + encodeURI(url);
    }
    function decodePdfUrl(url) {
        return decodeURI(url).substring(serverPerfix.length);
    }
    function encodeString(string) { return "`" + string + "`" }
    function decodeString(string) {
        const matched = string?.match(/\`(.*)\`/)
        return matched ? JSON.parse(matched[1]) : '';
    }
    //////////////////////Others END/////////////////////////
    /////////////////////////////////////////////////////////
    /***************Helper Functions END********************/
    /*******************************************************/
    /*******************************************************/
    /**************Helper from Internet BEGIN***************/
    /////////////////////////////////////////////////////////
    //////////////////Hex to RBGA Conversion BEGIN///////////
    const removeHash = hex => (hex.charAt(0) === '#' ? hex.slice(1) : hex);
    const parseHex = (nakedHex) => {
        const isShort = (
            nakedHex.length === 3
            || nakedHex.length === 4
        );

        const twoDigitHexR = isShort ? `${nakedHex.slice(0, 1)}${nakedHex.slice(0, 1)}` : nakedHex.slice(0, 2);
        const twoDigitHexG = isShort ? `${nakedHex.slice(1, 2)}${nakedHex.slice(1, 2)}` : nakedHex.slice(2, 4);
        const twoDigitHexB = isShort ? `${nakedHex.slice(2, 3)}${nakedHex.slice(2, 3)}` : nakedHex.slice(4, 6);
        const twoDigitHexA = ((isShort ? `${nakedHex.slice(3, 4)}${nakedHex.slice(3, 4)}` : nakedHex.slice(6, 8)) || 'ff');

        // const numericA = +((parseInt(a, 16) / 255).toFixed(2));

        return {
            r: twoDigitHexR,
            g: twoDigitHexG,
            b: twoDigitHexB,
            a: twoDigitHexA,
        };
    };
    const hexToDecimal = hex => parseInt(hex, 16);
    const hexesToDecimals = ({
        r, g, b, a,
    }) => ({
        r: hexToDecimal(r),
        g: hexToDecimal(g),
        b: hexToDecimal(b),
        a: +((hexToDecimal(a) / 255).toFixed(2)),
    });
    const isNumeric = n => !isNaN(parseFloat(n)) && isFinite(n); // eslint-disable-line no-restricted-globals, max-len
    const formatRgb = (decimalObject, parameterA) => {
        const {
            r, g, b, a: parsedA,
        } = decimalObject;
        const a = isNumeric(parameterA) ? parameterA : parsedA;

        return `rgba(${r}, ${g}, ${b}, ${a})`;
    };
    const hexToRgba = (hex, a) => {
        const hashlessHex = removeHash(hex);
        const hexObject = parseHex(hashlessHex);
        const decimalObject = hexesToDecimals(hexObject);

        return formatRgb(decimalObject, a);
    };
    ////////////////////Hex to RBGA Conversion END////////////
    /////////////////////////////////////////////////////////
    //Making named color from hex
    let ntc = {

        init: function () {
            let color, rgb, hsl;
            for (let i = 0; i < ntc.names.length; i++) {
                color = "#" + ntc.names[i][0];
                rgb = ntc.rgb(color);
                hsl = ntc.hsl(color);
                ntc.names[i].push(rgb[0], rgb[1], rgb[2], hsl[0], hsl[1], hsl[2]);
            }
        },

        name: function (color) {

            color = color.toUpperCase();
            if (color.length < 3 || color.length > 7)
                return ["#000000", "Invalid Color: " + color, false];
            if (color.length % 3 == 0)
                color = "#" + color;
            if (color.length == 4)
                color = "#" + color.substr(1, 1) + color.substr(1, 1) + color.substr(2, 1) + color.substr(2, 1) + color.substr(3, 1) + color.substr(3, 1);

            let rgb = ntc.rgb(color);
            let r = rgb[0], g = rgb[1], b = rgb[2];
            let hsl = ntc.hsl(color);
            let h = hsl[0], s = hsl[1], l = hsl[2];
            let ndf1 = 0, ndf2 = 0, ndf = 0;
            let cl = -1, df = -1;

            for (let i = 0; i < ntc.names.length; i++) {
                if (color == "#" + ntc.names[i][0])
                    return ["#" + ntc.names[i][0], ntc.names[i][1], true];

                ndf1 = Math.pow(r - ntc.names[i][2], 2) + Math.pow(g - ntc.names[i][3], 2) + Math.pow(b - ntc.names[i][4], 2);
                ndf2 = Math.pow(h - ntc.names[i][5], 2) + Math.pow(s - ntc.names[i][6], 2) + Math.pow(l - ntc.names[i][7], 2);
                ndf = ndf1 + ndf2 * 2;
                if (df < 0 || df > ndf) {
                    df = ndf;
                    cl = i;
                }
            }

            return (cl < 0 ? ["#000000", "Invalid Color: " + color, false] : ["#" + ntc.names[cl][0], ntc.names[cl][1], false]);
        },

        // adopted from: Farbtastic 1.2
        // http://acko.net/dev/farbtastic
        hsl: function (color) {

            let rgb = [parseInt('0x' + color.substring(1, 3)) / 255, parseInt('0x' + color.substring(3, 5)) / 255, parseInt('0x' + color.substring(5, 7)) / 255];
            let min, max, delta, h, s, l;
            let r = rgb[0], g = rgb[1], b = rgb[2];

            min = Math.min(r, Math.min(g, b));
            max = Math.max(r, Math.max(g, b));
            delta = max - min;
            l = (min + max) / 2;

            s = 0;
            if (l > 0 && l < 1)
                s = delta / (l < 0.5 ? (2 * l) : (2 - 2 * l));

            h = 0;
            if (delta > 0) {
                if (max == r && max != g) h += (g - b) / delta;
                if (max == g && max != b) h += (2 + (b - r) / delta);
                if (max == b && max != r) h += (4 + (r - g) / delta);
                h /= 6;
            }
            return [parseInt(h * 255), parseInt(s * 255), parseInt(l * 255)];
        },

        // adopted from: Farbtastic 1.2
        // http://acko.net/dev/farbtastic
        rgb: function (color) {
            return [parseInt('0x' + color.substring(1, 3)), parseInt('0x' + color.substring(3, 5)), parseInt('0x' + color.substring(5, 7))];
        },

        names: [
            ["f0f8ff", "Aliceblue"],
            ["faebd7", "AntiqueWhite"],
            ["00ffff", "Aqua"],
            ["7fffd4", "Aquamarine"],
            ["f0ffff", "Azure"],
            ["f5f5dc", "Beige"],
            ["ffe4c4", "Bisque"],
            ["000000", "Black"],
            ["ffebcd", "BlanchedAlmond"],
            ["0000ff", "Blue"],
            ["8a2be2", "BlueViolet"],
            ["FED33C", "BrightSun"],
            ["a52a2a", "Brown"],
            ["deb887", "BurlyWood"],
            ["5f9ea0", "CadetBlue"],
            ["7fff00", "Chartreuse"],
            ["d2691e", "Chocolate"],
            ["ff7f50", "Coral"],
            ["6495ed", "CornFlowerBlue"],
            ["fff8dc", "CornSilk"],
            ["dc143c", "Crimson"],
            ["00ffff", "Cyan"],
            ["00008b", "DarkBlue"],
            ["008b8b", "DarkCyan"],
            ["b8860b", "DarkGoldenRod"],
            ["006400", "DarkGreen"],
            ["a9a9a9", "DarkGrey"],
            ["bdb76b", "DarkKhaki"],
            ["8b008b", "DarkMagenta"],
            ["556b2f", "DarkOliveGreen"],
            ["ff8c00", "DarkOrange"],
            ["9932cc", "DarkOrchid"],
            ["8b0000", "DarkRed"],
            ["e9967a", "DarkSalmon"],
            ["8fbc8f", "DarkSeaGreen"],
            ["483d8b", "DarkSlateBlue"],
            ["2f4f4f", "DarkSlateGrey"],
            ["00ced1", "DarkTurquoise"],
            ["9400d3", "DarkViolet"],
            ["ff1493", "DeepPink"],
            ["00bfff", "DeepSkyBlue"],
            ["696969", "DimGrey"],
            ["1e90ff", "DodgerBlue"],
            ["b22222", "FireBrick"],
            ["fffaf0", "FloralWhite"],
            ["228b22", "ForestGreen"],
            ["ff00ff", "Fuchsia"],
            ["dcdcdc", "Gainsboro"],
            ["f8f8ff", "GhostWhite"],
            ["ffd700", "Gold"],
            ["daa520", "GoldenRod"],
            ["008000", "Green"],
            ["adff2f", "GreenYellow"],
            ["808080", "Grey"],
            ["f0fff0", "Honeydew"],
            ["ff69b4", "HotPink"],
            ["cd5c5c", "IndianRed"],
            ["4b0082", "Indigo"],
            ["fffff0", "Ivory"],
            ["f0e68c", "Khaki"],
            ["e6e6fa", "Lavender"],
            ["fff0f5", "LavenderBlush"],
            ["7cfc00", "LawnGreen"],
            ["fffacd", "LemonChiffon"],
            ["add8e6", "LightBlue"],
            ["f08080", "LightCoral"],
            ["e0ffff", "LightCyan"],
            ["fafad2", "LightGoldenRodYellow"],
            ["90ee90", "LightGreen"],
            ["d3d3d3", "LightGrey"],
            ["ffb6c1", "LightPink"],
            ["ffa07a", "LightSalmon"],
            ["20b2aa", "LightSeaGreen"],
            ["87cefa", "LightSkyBlue"],
            ["778899", "LightSlateGrey"],
            ["b0c4de", "LightSteelBlue"],
            ["ffffe0", "LightYellow"],
            ["00ff00", "Lime"],
            ["32cd32", "LimeGreen"],
            ["faf0e6", "Linen"],
            ["ff00ff", "Magenta"],
            ["800000", "Maroon"],
            ["66cdaa", "MediumAquaMarine"],
            ["0000cd", "MediumBlue"],
            ["ba55d3", "MediumOrchid"],
            ["9370db", "MediumPurple"],
            ["3cb371", "MediumSeaGreen"],
            ["7b68ee", "MediumSlateBlue"],
            ["00fa9a", "MediumSpringGreen"],
            ["48d1cc", "MediumTurquoise"],
            ["c71585", "MediumVioletRFed"],
            ["191970", "MidnightBlue"],
            ["f5fffa", "MintCream"],
            ["ffe4e1", "MistyRose"],
            ["ffe4b5", "Moccasin"],
            ["ffdead", "NavajoWhite"],
            ["000080", "Navy"],
            ["fdf5e6", "OldLace"],
            ["808000", "Olive"],
            ["6b8e23", "OliveDrab"],
            ["ffa500", "Orange"],
            ["ff4500", "OrangeRed"],
            ["da70d6", "Orchid"],
            ["eee8aa", "PaleGoldenRod"],
            ["98fb98", "PaleGreen"],
            ["afeeee", "PaleTurquoise"],
            ["db7093", "PaleVioletRed"],
            ["ffefd5", "PapayaWhip"],
            ["ffdab9", "PeachPuff"],
            ["cd853f", "Peru"],
            ["ffc0cb", "Pink"],
            ["dda0dd", "Plum"],
            ["b0e0e6", "PowderBlue"],
            ["800080", "Purple"],
            ["ff0000", "Red"],
            ["bc8f8f", "RosyBrown"],
            ["4169e1", "RoyalBlue"],
            ["8b4513", "SaddleBrown"],
            ["fa8072", "Salmon"],
            ["f4a460", "SandyBrown"],
            ["2e8b57", "SeaGreen"],
            ["fff5ee", "SeaShell"],
            ["a0522d", "Sienna"],
            ["c0c0c0", "Silver"],
            ["87ceeb", "SkyBlue"],
            ["6a5acd", "SlateBlue"],
            ["708090", "SlateGrey"],
            ["fffafa", "Snow"],
            ["00ff7f", "SpringGreen"],
            ["4682b4", "SteelBlue"],
            ["d2b48c", "Tan"],
            ["008080", "Teal"],
            ["d8bfd8", "Thistle"],
            ["ff6347", "Tomato"],
            ["40e0d0", "Turquoise"],
            ["ee82ee", "Violet"],
            ["f5deb3", "Wheat"],
            ["ffffff", "White"],
            ["f5f5f5", "WhiteSmoke"],
            ["ffff00", "Yellow"],
            ["9acd32", "YellowGreen"]
        ]

    }
    ntc.init();
    //MD5 hashing 
    const calculateMD5 = (function calculateMD5Closure() {
        const r = new Uint8Array([
            7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
            9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
            16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
            15, 21,
        ]);

        const k = new Int32Array([
            -680876936, -389564586, 606105819, -1044525330, -176418897, 1200080426,
            -1473231341, -45705983, 1770035416, -1958414417, -42063, -1990404162,
            1804603682, -40341101, -1502002290, 1236535329, -165796510, -1069501632,
            643717713, -373897302, -701558691, 38016083, -660478335, -405537848,
            568446438, -1019803690, -187363961, 1163531501, -1444681467, -51403784,
            1735328473, -1926607734, -378558, -2022574463, 1839030562, -35309556,
            -1530992060, 1272893353, -155497632, -1094730640, 681279174, -358537222,
            -722521979, 76029189, -640364487, -421815835, 530742520, -995338651,
            -198630844, 1126891415, -1416354905, -57434055, 1700485571, -1894986606,
            -1051523, -2054922799, 1873313359, -30611744, -1560198380, 1309151649,
            -145523070, -1120210379, 718787259, -343485551,
        ]);

        function hash(data, offset, length) {
            let h0 = 1732584193,
                h1 = -271733879,
                h2 = -1732584194,
                h3 = 271733878;
            // pre-processing
            const paddedLength = (length + 72) & ~63; // data + 9 extra bytes
            const padded = new Uint8Array(paddedLength);
            let i, j;
            for (i = 0; i < length; ++i) {
                padded[i] = data[offset++];
            }
            padded[i++] = 0x80;
            const n = paddedLength - 8;
            while (i < n) {
                padded[i++] = 0;
            }
            padded[i++] = (length << 3) & 0xff;
            padded[i++] = (length >> 5) & 0xff;
            padded[i++] = (length >> 13) & 0xff;
            padded[i++] = (length >> 21) & 0xff;
            padded[i++] = (length >>> 29) & 0xff;
            padded[i++] = 0;
            padded[i++] = 0;
            padded[i++] = 0;
            const w = new Int32Array(16);
            for (i = 0; i < paddedLength;) {
                for (j = 0; j < 16; ++j, i += 4) {
                    w[j] =
                        padded[i] |
                        (padded[i + 1] << 8) |
                        (padded[i + 2] << 16) |
                        (padded[i + 3] << 24);
                }
                let a = h0,
                    b = h1,
                    c = h2,
                    d = h3,
                    f,
                    g;
                for (j = 0; j < 64; ++j) {
                    if (j < 16) {
                        f = (b & c) | (~b & d);
                        g = j;
                    } else if (j < 32) {
                        f = (d & b) | (~d & c);
                        g = (5 * j + 1) & 15;
                    } else if (j < 48) {
                        f = b ^ c ^ d;
                        g = (3 * j + 5) & 15;
                    } else {
                        f = c ^ (b | ~d);
                        g = (7 * j) & 15;
                    }
                    const tmp = d,
                        rotateArg = (a + f + k[j] + w[g]) | 0,
                        rotate = r[j];
                    d = c;
                    c = b;
                    b = (b + ((rotateArg << rotate) | (rotateArg >>> (32 - rotate)))) | 0;
                    a = tmp;
                }
                h0 = (h0 + a) | 0;
                h1 = (h1 + b) | 0;
                h2 = (h2 + c) | 0;
                h3 = (h3 + d) | 0;
            }
            // prettier-ignore
            return new Uint8Array([
                h0 & 0xFF, (h0 >> 8) & 0xFF, (h0 >> 16) & 0xFF, (h0 >>> 24) & 0xFF,
                h1 & 0xFF, (h1 >> 8) & 0xFF, (h1 >> 16) & 0xFF, (h1 >>> 24) & 0xFF,
                h2 & 0xFF, (h2 >> 8) & 0xFF, (h2 >> 16) & 0xFF, (h2 >>> 24) & 0xFF,
                h3 & 0xFF, (h3 >> 8) & 0xFF, (h3 >> 16) & 0xFF, (h3 >>> 24) & 0xFF
            ]);
        }

        return hash;
    })();
    /**************Helper from Internet END***************/
    /*******************************************************/
    let initInterval = window.setInterval(initPdf, 1000);
    onunloadfns.push(() => clearInterval(initInterval));
}

export default {
    onload: onload,
    onunload: onunload
}