var Parser = require("../src/j2x");

describe("XMLParser", function () {

      it("should parse to XML with nested tags", function () {
        var jObj = {
            a : {
                b : {
                    c : "val1",
                    d : "val2"
                }
            }
        };
        var parser = new Parser();
        var result = parser.parse(jObj);
        //console.log(result);
        var expected = "<a><b><c>val1</c><d>val2</d></b></a>"
        expect(result).toEqual(expected);
      });

      it("should parse text property to tag value ", function () {
        var jObj = {
            a : {
                b : {
                    "#text" : "val1",
                    d : "val2"
                }
            }
        };
        var parser = new Parser();
        var result = parser.parse(jObj);
        //console.log(result);
        var expected = "<a><b>val1<d>val2</d></b></a>"
        expect(result).toEqual(expected);
      });


      it("should parse to XML with array", function () {
        var jObj = {
            a : {
                b : [
                    "val1",
                    { c : "val2"}
                ]
            }
        };
        var parser = new Parser();
        var result = parser.parse(jObj);
        var expected = "<a><b>val1</b><b><c>val2</c></b></a>";
        expect(result).toEqual(expected);
      });

      it("should parse  attributes properties as tag when options are not given", function () {
        var jObj = {
            a : {
                "@_b" : "val1",
                "@_c" : "val2"
            }
        };
        var parser = new Parser();
        var result = parser.parse(jObj);
        //console.log(result);
        var expected = "<a><@_b>val1</@_b><@_c>val2</@_c></a>";
        expect(result).toEqual(expected);
      });

      it("should parse to XML with attributes", function () {
        var jObj = {
            a : {
                "@_b" : "val1",
                "#text": "textvalue",
                tag: {
                    k: 34
                },
                "@_c" : "val2"
            }
        };
        var parser = new Parser({
            ignoreAttributes : false,
            attributeNamePrefix : "@_"
        });
        var result = parser.parse(jObj);
        //console.log(result);
        var expected = '<a b="val1" c="val2">textvalue<tag><k>34</k></tag></a>';
        expect(result).toEqual(expected);
      });

      it("should parse to XML with attributes as separate node", function () {
        var jObj = {
            a : {
                "@": {
                    b : "val1",
                    c : "val2"
                },
                "#text": "textvalue",
                tag: {
                    k: 34
                }
            }
        };
        var parser = new Parser({
            ignoreAttributes : false,
            attributeNamePrefix : "@_",
            attrNodeName: "@"
        });
        var result = parser.parse(jObj);
        //console.log(result);
        var expected = '<a b="val1" c="val2">textvalue<tag><k>34</k></tag></a>';
        expect(result).toEqual(expected);
      });

      it("should parse grouped attributes as tag name when options are not set", function () {
        var jObj = {
            a : {
                "@": {
                    b : "val1",
                    c : "val2"
                },
                "#text": "textvalue",
                tag: {
                    k: 34
                }
            }
        };
        var parser = new Parser({
            ignoreAttributes : false
        });
        var result = parser.parse(jObj);
        //console.log(result);
        var expected = '<a><@><b>val1</b><c>val2</c></@>textvalue<tag><k>34</k></tag></a>';
        expect(result).toEqual(expected);
      });

      it("should parse to XML with cdata", function () {
        var jObj = {
            a : {
                "@": {
                    b : "val1",
                    c : "val2"
                },
                "#text": "textvalue\\c",
                "__cdata": "this text is from CDATA",
                tag: {
                    k: 34
                }
            }
        };
        var parser = new Parser({
            cdataTagName : "__cdata",
        });
        var result = parser.parse(jObj);
        //console.log(result);
        var expected = '<a><@><b>val1</b><c>val2</c></@>textvalue<![CDATA[this text is from CDATA]]><tag><k>34</k></tag></a>';
        expect(result).toEqual(expected);
      });

      it("should parse to XML with multiple cdata", function () {
        var jObj = {
            a : {
                "@": {
                    b : "val1",
                    c : "val2"
                },
                "#text": "text\\cvalue\\c",
                tag: {
                    k: 34
                },
                "__cdata": [
                    "this text is from CDATA",
                    "this is another text"
                ]
            }
        };
        var parser = new Parser({
            cdataTagName : "__cdata",
        });
        var result = parser.parse(jObj);
        //console.log(result);
        var expected = '<a><@><b>val1</b><c>val2</c></@><tag><k>34</k></tag>text<![CDATA[this text is from CDATA]]>value<![CDATA[this is another text]]></a>';
        expect(result).toEqual(expected);
      });

      it("should parse to XML with multiple cdata but textnode is not present", function () {
        var jObj = {
            a : {
                "@": {
                    b : "val1",
                    c : "val2"
                },
                tag: {
                    k: 34
                },
                "__cdata": [
                    "this text is from CDATA",
                    "this is another text"
                ]
            }
        };
        var parser = new Parser({
            cdataTagName : "__cdata",
        });
        var result = parser.parse(jObj);
        //console.log(result);
        var expected = '<a><@><b>val1</b><c>val2</c></@><tag><k>34</k></tag><![CDATA[this text is from CDATA]]><![CDATA[this is another text]]></a>';
        expect(result).toEqual(expected);
      });

});