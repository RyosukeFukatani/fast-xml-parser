var util = require("./util");
var he = require("he");

var defaultOptions = {
    attrNamePrefix : "@_",                              //prefix for attributes
    attrNodeName: false,                       //Group attributes in separate node
    textNodeName : "#text",                 //Name for property which will have value of the node in case nested nodes are present, or attributes
    //ignoreNonTextNodeAttr : true,       
    //ignoreTextNodeAttr : true,
    ignoreAttributes : true,                     //ignore attributes
    allowBooleanAttributes : false,         //A tag can have attributes without any value
    ignoreNameSpace : false,                 //ignore namespace from the name of a tag and attribute. It also removes xmlns attribute
    //ignoreRootElement : false,               //
    parseNodeValue : true,                 //convert the value of node to primitive type. E.g. "2" -> 2
    parseAttributeValue : false,          //convert the value of attribute to primitive type. E.g. "2" -> 2
    //arrayMode : false,                            //put the values in array
    //selfClosingTagToNull : false              //Bydefault self closing tag is set to empty string. It'll set their value as null

};


var buildOptions = function (options){
    if(!options) options = {};
    var props = ["attrNamePrefix","attrNodeName","ignoreAttributes","ignoreNameSpace","ignoreRootElement","textNodeName","parseNodeValue","parseAttributeValue","arrayMode"];
    for (var i = 0; i < props.length; i++) {
        if(options[props[i]] === undefined){
            options[props[i]] = defaultOptions[props[i]];
        }
    }
    return options;
};


//var tagsPattern = new RegExp("<\\/?([\\w:\\-_\.]+)\\s*\/?>","g");
exports.parse = function(xmlData, options){
    options = buildOptions(options);    
    
    xmlData = xmlData.replace(/(\r\n|\n|\r)/gm," ");//make it single line
    xmlData = xmlData.replace(/(^\s*<\?xml.*?\?>)/g,"");//Remove XML starting tag
    xmlData = xmlData.replace(/(<!DOCTYPE[\s\w\"\.\/\-\:]+(\[.*\])*\s*>)/g,"");//Remove DOCTYPE

    var tags = [];
    var nodes = [];
    var rootNode = {};
    var currentObject = rootNode;
    var parentObject = rootNode;

    nodes.push(currentObject);
    for (var i = 0; i < xmlData.length; i++) {
        var attrObj = {};
        var textValue = "";
    
        if(xmlData[i] === "<"){//starting of tag
            //read until you reach to '>' avoiding any '>' in attribute value

            i++;

            if(xmlData[i] === "!"){
                i = readCommentAndCDATA(xmlData,i); //comments only
                continue;
            }else{
                var closingTag = false;
                if(xmlData[i] === "/"){//closing tag
                    closingTag = true;
                    i++;
                }
                //read tagname
                var tagName = "";
                for(;i < xmlData.length
                    && xmlData[i] !== ">"
                    && xmlData[i] !== " "
                    && xmlData[i] !== "\t" ; i++) {

                    tagName +=xmlData[i];
                }
                tagName = resolveNameSpace(tagName.trim(),options.ignoreNameSpace);
                //console.log(tagName);

                if(tagName[tagName.length-1] === "/"){//self closing tag without attributes
                    tagName = tagName.substring(0,tagName.length-1);
                    currentObject[tagName] = "";
                    continue;
                }
                if(!validateTagName(tagName)) return false;


                var result = readAttributeStr(xmlData,i);
                if(result === false) {
                    return { err: { code:"InvalidAttr",msg:"Attributes for " + tagName + " have open quote"}};
                }
                var attrStr = result.value;
                i = result.index;

                if(attrStr[attrStr.length-1] === "/" ){//self closing tag
                    attrStr = attrStr.substring(0,attrStr.length-1);
                    //console.log(attrStr);

                    var operationResult = fillWithAttributes(attrObj,attrStr,options);
                    if(operationResult.err !== undefined){
                        return operationResult.err;
                    }else{
                        var newObj = {}
                        if(isEmptyObject(attrObj)){
                            newObj = "";
                        }else{
                            merge(attrObj,newObj);
                        }
                        currentObject = addNode(newObj,currentObject,parentObject,tagName, nodes,tags,options);
                        continue;
                    }
                }else if(closingTag){
                    if(attrStr.trim().length > 0){
                        return { err: { code:"InvalidTag",msg:"closing tag " + tagName + " can't have attributes."}};
                    }else{
                        var otg = tags.pop();
                        if(tagName !== otg){
                            return { err: { code:"InvalidTag",msg:"closing tag " + otg + " is expected inplace of "+tagName+"."}};
                        }

                        var result = handleClosingTag(xmlData,i, tagName, nodes,options);
                        i=result.index;
                        currentObject = result.currentNode;
                        continue;
                    }
                }else{
                   

                    var operationResult = fillWithAttributes(attrObj,attrStr,options);
                    if(operationResult.err !== undefined){
                        return operationResult.err;
                    }

                    var output = readTextValue(xmlData,i, options);
                    i = output.index;
                    textValue = output.value;

                    var newObj = {};

                    if(isEmptyObject(attrObj)){
                        newObj = textValue;    
                    }else{
                        merge(attrObj,newObj);
                        if(textValue !== "")
                            newObj[options.textNodeName] = textValue;
                    }

                    
                    if( parentObject[options.textNodeName] === ""){
                        delete parentObject[options.textNodeName];
                    }
                    currentObject = addNode(newObj,currentObject,parentObject,tagName, nodes,tags,options);
                    tags.push(tagName);
                    
                    nodes.push(newObj);
                    parentObject = currentObject;
                    currentObject= newObj;
                }
            }
        }else{

            if(xmlData[i] === " " || xmlData[i] === "\t") continue;
            return { err: { code:"InvalidChar",msg:"char " + xmlData[i] +" is not expected ."}};
        }
    }


    if(tags.length > 0){
        return { err: { code:"InvalidXml",msg:"Invalid " + JSON.stringify(tags,null,4) +" found."}};
    }
    return { "json" : rootNode};
}

/**
 * 
 * @param {*} newObj 
 * @param {*} currentObject 
 * @param {*} parentObject 
 * @param {string} tagName 
 * @param {array} nodes 
 * @param {array} tags 
 * @param {*} options 
 */
function addNode(newObj,currentObject,parentObject,tagName, nodes,tags,options){
    if(typeof currentObject !== "object"){
        var val = currentObject;
        currentObject = {};
        if(val !== ""){
            currentObject[options.textNodeName] = val;
        }
         var parentTag = tags[tags.length - 1];
         parentObject[parentTag] = currentObject;
         nodes.pop();
         nodes.push(currentObject);
    }
    if(currentObject[tagName] !== undefined){//already present
        var swap = currentObject[tagName];
        if(!(currentObject[tagName]   instanceof Array)){
            currentObject[tagName] = [];
            currentObject[tagName].push(swap);
        }
        currentObject[tagName].push(newObj);
    }else{
        currentObject[tagName] = newObj;
    }

    return currentObject;
}

/**
 * Keep reading xmlData until '<' is found outside the attribute value.
 * @param {string} xmlData 
 * @param {number} i 
 */
function readAttributeStr(xmlData,i){
    var attrStr = "";
    var startChar = "";
    for(;i < xmlData.length ;i++){
        if(xmlData[i] === '"' || xmlData[i] === "'"){
            if(startChar === ""){
                startChar = xmlData[i];
            }else{
                startChar = "";
            }
        }else if(xmlData[i] === ">"){
            if(startChar === ""){
                break;
            }
        }
        attrStr += xmlData[i];
    }
    if(startChar !== "") return false;//open quote

    return { value: attrStr, index: i};
}

/**
 * Pop the current node out from stack
 * If the closing tag is having only textNode property, covert the closing tag into string and assign the value
 * Read if there is any text after closing tag. Assign it to textNode property of parent node.
 * 
 * @param {String} xmlData 
 * @param {number} i 
 * @param {array} nodes 
 * @param {object} options
 */
function handleClosingTag(xmlData,i, tagName, nodes,options){
    var closingNode =  nodes.pop();
    currentObject = nodes[nodes.length -1 ];

    if( closingNode[options.textNodeName] !== undefined ) {
        var keyCount = countOwnKeys(closingNode);
        if( keyCount === 1){//convert to string
            /* if(currentObject[tagName]   instanceof Array){
                currentObject[tagName].push(closingNode[options.textNodeName]);
            }else{ */
                currentObject[tagName] = closingNode[options.textNodeName];
            //}

        }else if(keyCount > 1 && closingNode[options.textNodeName] === ""){//remove empty textNode
            delete currentObject[tagName][options.textNodeName];
        }
    }

    var output = readTextValue(xmlData,i, options);
    i = output.index;

    if(output.value !== "") {
        if(currentObject[options.textNodeName] === undefined){
            currentObject[options.textNodeName] = "";
        }
        currentObject[options.textNodeName] += output.value;
    }

    return { index:i, currentNode: currentObject};
}

function readCommentAndCDATA(xmlData,i){
    if(xmlData.length > i+5 && xmlData[i+1] === "-" && xmlData[i+2] === "-"){//comment
        for(i+=3;i<xmlData.length;i++){
            if(xmlData[i] === "-" && xmlData[i+1] === "-" && xmlData[i+2] === ">"){
                i+=2;
                break;
            }
        }
    }else if( xmlData.length > i+9
        && xmlData[i+1] === "["
        && xmlData[i+2] === "C"
        && xmlData[i+3] === "D"
        && xmlData[i+4] === "A"
        && xmlData[i+5] === "T"
        && xmlData[i+6] === "A"
        && xmlData[i+7] === "["){

        for(i+=8;i<xmlData.length;i++){
            if(xmlData[i] === "]" && xmlData[i+1] === "]" && xmlData[i+2] === ">" ){
                i+=2;
                break;
            }
        }
    }

    return i;
}

/**
 * Reads until '<' is found. HTML Decode non-CDATA part. 
 * @param {*} xmlData 
 * @param {*} i 
 */
function readTextValue(xmlData,i,options){
    var vals = [];
    var val = ""
    var cdatapresent = false;
    for(i++;i < xmlData.length ; i++){
        if(xmlData[i] === "<"){
            if(xmlData[i+1] === "!"){//comment or CADATA
                i++;
                var end_index = readCommentAndCDATA(xmlData,i);
                if(xmlData[i+1] === '['){
                    cdatapresent = true;
                    vals.push(he.decode(val, { strict:true})); val = "";
                    var cdataVal = xmlData.substring(i+8,end_index-2);
                    vals.push(cdataVal);
                }else{
                    //skip
                }
                i=end_index;
                continue;
            }else{
                break;
            }
        }else{
            val += xmlData[i] ;
        }
        
    }//end of reading tag text value
    vals.push(he.decode(val, { strict:true}));
    val = vals.join("");
    if(xmlData[i] === "<") i--;

    var textValue = "";
    if(val.length !== 0){
        if(cdatapresent || !options.parseNodeValue){
            textValue = val;
        }else{
            textValue = parseValue(val,options,false);
        }
    }
    return { index: i, value: textValue};
}

function fillWithAttributes(node,attrStr,options){

    var attrObj = validateAndBuildAttributes(attrStr,options);
    if(attrObj.err !== undefined){
        return attrObj.err;
    }else if(!options.ignoreAttributes && !isEmptyObject(attrObj)){
        if(options.attrNodeName === false){//Group attributes as separate property
            //for (var attr in attrObj) { node[attr] = attrObj[attr]; }
            merge(attrObj,node);
        }else{
            node[options.attrNodeName] = attrObj;
        }
    }
    return true;
}
/**
 * Select all the attributes whether valid or invalid.
 */
var validAttrStrRegxp = new RegExp("(\\s*)([^\\s=]+)\\s*(=)?(\\s*(['\"])((.|\\n)*?)\\5)?", "g");

//attr, ="sd", a="amit's", a="sd"b="saf", ab  cd=""

function validateAndBuildAttributes(attrStr,options){

    attrNamePrefix = options.attrNamePrefix === undefined ? "" : options.attrNamePrefix;

    var matches = util.getAllMatches(attrStr,validAttrStrRegxp);
    var attrNames = [];
    var attrObj = {};

    for(var i=0;i<matches.length;i++){
        if(matches[i][1].length === 0){//nospace before attribute name: a="sd"b="saf"
            return { err: { code:"InvalidAttr",msg:"attribute " + matches[i][2] + " has no space in starting."}};
        }else if(matches[i][3] === undefined && !options.allowBooleanAttributes){//independent attribute: ab 
            return { err: { code:"InvalidAttr",msg:"boolean attribute " + matches[i][2] + " is not allowed."}};
        }/* else if(matches[i][6] === undefined){//attribute without value: ab=
            return { err: { code:"InvalidAttr",msg:"attribute " + matches[i][2] + " has no value assigned."}};
        } */
        attrName=matches[i][2];
        if(!validateAttrName(attrName)){
            return { err: { code:"InvalidAttr",msg:"attribute " + matches[i][2] + " has an invalid name."}};
        }
        if(!attrNames.hasOwnProperty(attrName)){//check for duplicate attribute.
            attrNames[attrName]=1;
        }else{
            return { err: { code:"InvalidAttr",msg:"attribute " + matches[i][2] + " is repeated."}};
        }
        var attrName = resolveNameSpace(matches[i][2],options.ignoreNameSpace);
        if(attrName !== ""){
            if( matches[i][3] === undefined && options.allowBooleanAttributes ){
                attrObj[attrNamePrefix + attrName] = true;
            }else if(options.parseAttributeValue){
                attrObj[attrNamePrefix + attrName] = parseValue( he.decode(matches[i][6], {isAttributeValue:true, strict:true}),options,true);
            }
            else{
                attrObj[attrNamePrefix + attrName] = he.decode(matches[i][6], {isAttributeValue:true, strict:true});
            }
        }
        
    }

    return attrObj;
    
}

function parseValue(val,options,isAttribute){
    if(val){
        if( isNaN(val)){
            val = "" + val;
            if(isAttribute) {
                val = val.replace(/\r?\n/g, " ");
            }

        }else{//Number
            if(val.indexOf(".") !== -1){
                if(parseFloat){
                    val = parseFloat(val);
                }else{//IE support
                    val = Number.parseFloat(val);
                }
            }else{
                if(parseInt){
                    val = parseInt(val,10);
                }else{//IE support
                    val = Number.parseInt(val,10);
                }
            }
        }
    }else{
        val = "";
    }
    return val;
}

var validAttrRegxp = new RegExp("^[_a-zA-Z][\\w\\-\\.\\:]*$");


function validateAttrName(attrName){
    return util.doesMatch(attrName,validAttrRegxp);
}
//var startsWithXML = new RegExp("^[Xx][Mm][Ll]");
var startsWith = new RegExp("^([a-zA-Z]|_)[\\w\.\\-_:]*");

function validateTagName(tagname){
    /*if(util.doesMatch(tagname,startsWithXML)) return false;
    else*/ if(util.doesNotMatch(tagname,startsWith)) return false;
    else return true;
}

function countOwnKeys(obj) {
    var counter = 0;
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        counter ++;
      }
    }
    return counter;
  }


function isEmptyObject(obj) {
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Merge a into b and returns b;
   * @param {*} a 
   * @param {*} b 
   */
function merge(a,b){
    if(b !== undefined)
        for (var attr in a) { b[attr] = a[attr]; }
    return b;
}

/**
 * remove leftside from tag / attribute name 
 * E.g. ns:tag => tag
 * @param {string} tagname 
 * @param {boolean} ignore 
 */
function resolveNameSpace(tagname,ignore){
    if(ignore){
        var tags = tagname.split(":");
        var prefix = tagname.charAt(0) === "/" ? "/" : "";
        if(tags[0] === "xmlns") {
            return "";
        }else if(tags.length === 2) {
            tagname = prefix + tags[1];
        }
    }
    return tagname;
}