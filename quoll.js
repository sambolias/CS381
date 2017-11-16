// quoll.js
// VERSION 0.13a
// Glenn G. Chappell
// 23 Oct 2017
//
// Simple WebGL Framework & Utilities
// Uses glMatrix (gl-matrix.js / gl-matrix-min.js) for matrix type
// Based on toomuch.js by GGC
//
// History (prior to v0.9, version numbers are for toomuch.js)
// - v0.1-0.4: Miscellaneous foolishness.
// - v0.5:  Write drawSquare, drawCube, drawSphere, drawCylinder.
//          Add optional alpha param to drawXxx functions.
// - v0.6:  Fix incorrect texture coordinates in shapes.
// - v0.7:  Improve comments, error messages.
// - v0.8:  Add Mini-GLUT
// - v0.9:  Change name to quoll.js.
//          Move matrix handling to glMatrix.
//          WebGL context stored by caller, not this package.
//          No more keypress callback.
//          Make full-window canvas optional.
//          Revise function names.
// - v0.10: Use glMatrix types for all vector-like values.
//          Write drawLine, drawTriangle.
// - v0.11: Add primBegin-primEnd API.
// - v0.12: Fix transformation handling in drawCube.
// - v0.13: Speed up by getting attribute/uniform locations only once.
//          Add drawCubeArray.
//          Elim error messages when context is missing matrix members.


// Internal-use items have names ending with '_I_'. All others
// are available for external use.

// Assumptions about WebGL contexts:
// - A context passed to any of the functions in this file will be one
//   returned by quollInit -- which creates and initializes members
//   pMatrix, mvMatrix, and tMatrix, representing the projection,
//   model/view, and texture matrices, respectively, as well as other
//   ..._I_ members (for internal use).

// Assumptions about shaders:
// - Vertex coordinates, color, normal vector, texture coordinates, and
//   tangent vector, IF THESE ARE USED, are the respective variables as
//   follows:
//
//     attribute vec4 vertex_attr;
//     attribute vec4 color_attr;
//     attribute vec3 normal_attr;
//     attribute vec4 texcoord_attr;
//     attribute vec3 tangent_attr;
//
// - The projection matrix, model/view matrix, normal matrix, and
//   texture matrix, IF THESE ARE USED, are the respective variables as
//   follows:
//
//     uniform mat4 projectionMatrix;
//     uniform mat4 modelViewMatrix;
//     uniform mat3 normalMatrix;
//     uniform mat4 textureMatrix;
//
// Note that, if a variable is not used in a shader, then it need not be
// declared.


// errOut
// Given string, attempts to print it as an error message.
// - Try to find HTML element with ID 'err'. If found, append message to
//   its content.
// - If above fails, log message to window console.
// - If above fail, display an alert with the message.
function errOut(msg)
{
    var f = arguments.callee;  // Current function
    if (!f.inited)
    {
        f.inited = true;
        f.which = 0;
    }
    ++f.which;
    var fullmsg = '[APPLICATION ERROR] ' + msg;

    var e = document.getElementById('err');
    if (e)
    {
        e.innerHTML +=
            encodeStringForHTMLText_I_(fullmsg) + '<br>';
        return;
    }

    if ('console' in window &&
        'error' in window.console &&
        typeof window.console.error == 'function')
    {
        window.console.error(fullmsg);
        return;
    }

    alert(fullmsg);
}


// encodeStringForHTMLText_I_
// Given an ASCII string, encode it so that it can be included as
// viewable text in an HTML document. Returns encoded string.
function encodeStringForHTMLText_I_(str)
{
    return str
        .replace(/\&/g, '&amp;')
        .replace(/\</g, '&lt;')
        .replace(/\>/g, '&gt;');
}


// getElapsedTime
// Returns number of seconds (to nearest thousandth?) since previous
// call. Returns 0.0 on first call. If max is given, limits returned
// values to at most max.
function getElapsedTime(max)
{
    var f = arguments.callee;  // Current function
    if (!f.inited)
    {
        f.inited = true;
        f.savetime = new Date();
        return 0.;
    }
    else
    {
        var oldtime = f.savetime;
        f.savetime = new Date();
        var etime = (f.savetime - oldtime) / 1000.;
        if (typeof max != 'undefined' && etime > max)
            etime = max;
        return etime;
    }
}


// getMousePos
// Given a canvas and an event object, return glMatrix vec2 holding
// the event's mouse pos in canvas coordinates, or null on error.
function getMousePos(canvas, evt)
{
    if (!canvas || !canvas.getBoundingClientRect)
    {
        errOut(arguments.callee.name + ': ' +
               'No canvas.getBoundingClientRect');
        return null;
    }

    if (!evt || !evt.clientX || !evt.clientY)
    {
        errOut(arguments.callee.name + ': ' +
               'No event passed');
        return null;
    }

    var rect = canvas.getBoundingClientRect();
    if (!rect)
    {
        errOut(arguments.callee.name + ': ' +
               'Unable to get bounding rectangle');
        return null;
    }

    var result = vec2.fromValues(evt.clientX-rect.left,
                                 evt.clientY-rect.top);
    return result;
}


// whereAmI
// Given matrix cammat, finds the point that cammat takes to (the
// homogeneous form of) the origin. Thus, if cammat is the camera-
// transformation matrix, then we return the camera position in world
// coordinates.
//
// Return value is glMatrix vec3 holding camera position.
function whereAmI(cammat)
{
    var mat = mat4.create();
    mat4.invert(mat, cammat);  // Get inverse of cammat
    var result = vec3.fromValues(mat[12] / mat[15],
                                 mat[13] / mat[15],
                                 mat[14] / mat[15]);
    return result;
}


// checkContext_I_
// Checks whether ctx is a valid WebGL context. If not, signals error
// using given function name.
function checkContext_I_(ctx, funcname)
{
    if (typeof ctx != 'object' || !('clearColor' in ctx))
    {
        errOut(funcname + ': ' +
               'Called without valid WebGL context');
        return false;
    }
    return true;
}


// getProgram_I_
// Given WebGL context, returns active shader program object, or null if
// none. If none, signals error using given function name.
function getProgram_I_(ctx, funcname)
{
    if (!checkContext_I_(ctx, funcname))
        return null;
    var shaderprogram = ctx.getParameter(ctx.CURRENT_PROGRAM);
    if (!shaderprogram)
    {
        errOut(funcname + ': ' +
               'Called with context having no active shaders');
        return null;
    }
    return shaderprogram;
}


// getAttribLocs
// Given WebGL context, returns locations of standard attribute
// variables in an array. Each array item is attribute location or -1 if
// attribute not found in shaders. Attributes + their indices are as
// follows:
//
//     Index   Attribute
//       0     vertex_attr
//       1     color_attr
//       2     normal_attr
//       3     texcooord_attr
//       4     tangent_attr
//
// If no active shaders, signals error, returns null.
function getAttribLocs(ctx)
{
    var shaderprogram =
        getProgram_I_(ctx, arguments.callee.name);
    if (!shaderprogram)
        return null;

    if (!shaderprogram.attriblocs_I_)
    {
        shaderprogram.attriblocs_I_ = [
            ctx.getAttribLocation(shaderprogram, 'vertex_attr'),
            ctx.getAttribLocation(shaderprogram, 'color_attr'),
            ctx.getAttribLocation(shaderprogram, 'normal_attr'),
            ctx.getAttribLocation(shaderprogram, 'texcoord_attr'),
            ctx.getAttribLocation(shaderprogram, 'tangent_attr')
        ];
    }

    return shaderprogram.attriblocs_I_;
}


// drawLine
// Draw line segment between two given vertices.
//
// Normal and tangent vectors are all (0,0,1).
//
// ctx is WebGL context. r, g, b, a are optional arguments giving color.
// Uses standard attribute, uniform shader variable names; see comments
// @ beginning of this file.
function drawLine(ctx,
                  x1, y1, z1,  // Point #1
                  x2, y2, z2,  // Point #2
                  r, g, b, a)
{
    // Get attribute locations
    var attriblocs = getAttribLocs(ctx);
    if (!attriblocs)
    {
        errOut(arguments.callee.name + ': ' +
               'Could not get attribute locations');
        return;
    }

    // Set up parameters
    if (typeof r != 'number') r = 0.7;
    if (typeof g != 'number') g = 0.7;
    if (typeof b != 'number') b = 0.7;
    if (typeof a != 'number') a = 1.0;

    // Create VBOs
    var buffs = new Array(5);
    var datas = new Array(5);
    var numverts = 2;
    for (var i = 0; i < 5; ++i)
    {
        buffs[i] = ctx.createBuffer();
        var components = (i == 2 || i == 4) ? 3 : 4;
        datas[i] = new Float32Array(components*numverts);
    }
    var vertcoords = [x1, y1, z1, x2, y2, z2];
    for (var i = 0; i < numverts; ++i)
    {
        var b4 = 4*i;  // Base for indices
        var b3 = 3*i;

        // vertex coords
        datas[0][b4+0] = vertcoords[b3+0];
        datas[0][b4+1] = vertcoords[b3+1];
        datas[0][b4+2] = vertcoords[b3+2];
        datas[0][b4+3] = 1.;

        // color
        datas[1][b4+0] = r;
        datas[1][b4+1] = g;
        datas[1][b4+2] = b;
        datas[1][b4+3] = a;

        // normal
        datas[2][b3+0] = 0.;
        datas[2][b3+1] = 0.;
        datas[2][b3+2] = 1.;

        // texture coords
        datas[3][b4+0] = i;
        datas[3][b4+1] = 0.;
        datas[3][b4+2] = 0.;
        datas[3][b4+3] = 1.;

        // tangent
        datas[4][b3+0] = 1.;
        datas[4][b3+1] = 0.;
        datas[4][b3+2] = 0.;
    }
    for (var i in attriblocs)
    {
        if (attriblocs[i] == -1)
            continue;
        var components = (i == 2 || i == 4) ? 3 : 4;
        ctx.bindBuffer(ctx.ARRAY_BUFFER, buffs[i]);
        ctx.bufferData(
            ctx.ARRAY_BUFFER, datas[i], ctx.STATIC_DRAW);
        ctx.vertexAttribPointer(
            attriblocs[i], components, ctx.FLOAT, false, 0, 0);
    }

    // Set up uniforms, enable attributes
    sendMatrices(ctx);
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.enableVertexAttribArray(attriblocs[i]);

    // Draw with VBO
    ctx.drawArrays(ctx.LINES, 0, numverts);

    // Disable attributes
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.disableVertexAttribArray(attriblocs[i]);

    // Delete buffer objects
    for (i in buffs)
        ctx.deleteBuffer(buffs[i]);
}


// drawTriangle
// Draw solid triangle with given vertices.
//
// ctx is WebGL context. r, g, b, a are optional arguments giving color.
// Uses standard attribute, uniform shader variable names; see comments
// @ beginning of this file.
function drawTriangle(ctx,
                      x1, y1, z1,  // Vertex #1
                      x2, y2, z2,  // Vertex #2
                      x3, y3, z3,  // Vertex #3
                      r, g, b, a)
{
    // Get attribute locations
    var attriblocs = getAttribLocs(ctx);
    if (!attriblocs)
    {
        errOut(arguments.callee.name + ': ' +
               'Could not get attribute locations');
        return;
    }

    // Set up parameters
    if (typeof r != 'number') r = 0.7;
    if (typeof g != 'number') g = 0.7;
    if (typeof b != 'number') b = 0.7;
    if (typeof a != 'number') a = 1.0;

    // Create VBOs
    var buffs = new Array(5);
    var datas = new Array(5);
    var numverts = 3;
    for (var i = 0; i < 5; ++i)
    {
        buffs[i] = ctx.createBuffer();
        var components = (i == 2 || i == 4) ? 3 : 4;
        datas[i] = new Float32Array(components*numverts);
    }
    var vertcoords = [x1, y1, z1, x2, y2, z2, x3, y3, z3];
    for (var i = 0; i < numverts; ++i)
    {
        var x = (i == 1) ? 1. : 0.;
        var y = (i == 2) ? 1. : 0.;

        var b4 = 4*i;  // Base for indices
        var b3 = 3*i;

        var v12 = vec3.fromValues(x2-x1, y2-y1, z2-z1);
        var v13 = vec3.fromValues(x3-x1, y3-y1, z3-z1);
        var crossp = vec3.create();
        vec3.cross(crossp, v12, v13);

        // vertex coords
        datas[0][b4+0] = vertcoords[b3+0];
        datas[0][b4+1] = vertcoords[b3+1];
        datas[0][b4+2] = vertcoords[b3+2];
        datas[0][b4+3] = 1.;

        // color
        datas[1][b4+0] = r;
        datas[1][b4+1] = g;
        datas[1][b4+2] = b;
        datas[1][b4+3] = a;

        // normal
        datas[2][b3+0] = 0.;
        datas[2][b3+1] = 0.;
        datas[2][b3+2] = 1.;

        // texture coords
        datas[3][b4+0] = x;
        datas[3][b4+1] = y;
        datas[3][b4+2] = 0.;
        datas[3][b4+3] = 1.;

        // tangent
        var tanvec = vec3.create();
        vec3.normalize(tanvec, v12);
        datas[4][b3+0] = tanvec[0];
        datas[4][b3+1] = tanvec[1];
        datas[4][b3+2] = tanvec[2];
    }
    for (var i in attriblocs)
    {
        if (attriblocs[i] == -1)
            continue;
        var components = (i == 2 || i == 4) ? 3 : 4;
        ctx.bindBuffer(ctx.ARRAY_BUFFER, buffs[i]);
        ctx.bufferData(
            ctx.ARRAY_BUFFER, datas[i], ctx.STATIC_DRAW);
        ctx.vertexAttribPointer(
            attriblocs[i], components, ctx.FLOAT, false, 0, 0);
    }

    // Set up uniforms, enable attributes
    sendMatrices(ctx);
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.enableVertexAttribArray(attriblocs[i]);

    // Draw with VBO
    ctx.drawArrays(ctx.TRIANGLE_FAN, 0, numverts);

    // Disable attributes
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.disableVertexAttribArray(attriblocs[i]);

    // Delete buffer objects
    for (i in buffs)
        ctx.deleteBuffer(buffs[i]);
}


// drawSquare
// Draw solid square with given side length, centered at origin, in
// x,y-plane, axis-aligned.
//
// ctx is WebGL context. r, g, b, a are optional arguments giving color.
// Uses standard attribute, uniform shader variable names; see comments
// @ beginning of this file.
function drawSquare(ctx,
                    size,
                    r, g, b, a)
{
    // Make VBOs
    var f = arguments.callee;
    if (!f.madevbos)
    {
        f.buffs = new Array(5);
        for (var i = 0; i < 5; ++i)
        {
            f.buffs[i] = ctx.createBuffer();
        }
        f.madevbos = true;
    }

    // Get attribute locations
    var attriblocs = getAttribLocs(ctx);
    if (!attriblocs)
    {
        errOut(arguments.callee.name + ': ' +
               'Could not get attribute locations');
        return;
    }

    // Set up parameters
    if (typeof r != 'number') r = 0.7;
    if (typeof g != 'number') g = 0.7;
    if (typeof b != 'number') b = 0.7;
    if (typeof a != 'number') a = 1.0;

    // Make space for data
    var datas = new Array(5);
    var numverts = 4;
    for (var i = 0; i < 5; ++i)
    {
        var components = (i == 2 || i == 4) ? 3 : 4;
        datas[i] = new Float32Array(components*numverts);
    }
    for (var i = 0; i < numverts; ++i)
    {
        var x = (i == 1 || i == 2) ? 1. : 0.;
        var y = (i == 2 || i == 3) ? 1. : 0.;

        var b4 = 4*i;  // Base for indices
        var b3 = 3*i;

        // vertex coords
        datas[0][b4+0] = (x-0.5) * size;
        datas[0][b4+1] = (y-0.5) * size;
        datas[0][b4+2] = 0.;
        datas[0][b4+3] = 1.;

        // color
        datas[1][b4+0] = r;
        datas[1][b4+1] = g;
        datas[1][b4+2] = b;
        datas[1][b4+3] = a;

        // normal
        datas[2][b3+0] = 0.;
        datas[2][b3+1] = 0.;
        datas[2][b3+2] = 1.;

        // texture coords
        datas[3][b4+0] = x;
        datas[3][b4+1] = y;
        datas[3][b4+2] = 0.;
        datas[3][b4+3] = 1.;

        // tangent
        datas[4][b3+0] = 1.;
        datas[4][b3+1] = 0.;
        datas[4][b3+2] = 0.;
    }
    for (var i in attriblocs)
    {
        if (attriblocs[i] == -1)
            continue;
        var components = (i == 2 || i == 4) ? 3 : 4;
        ctx.bindBuffer(ctx.ARRAY_BUFFER, f.buffs[i]);
        ctx.bufferData(
            ctx.ARRAY_BUFFER, datas[i], ctx.STATIC_DRAW);
        ctx.vertexAttribPointer(
            attriblocs[i], components, ctx.FLOAT, false, 0, 0);
    }

    // Set up uniforms, enable attributes
    sendMatrices(ctx);
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.enableVertexAttribArray(attriblocs[i]);

    // Draw with VBO
    ctx.drawArrays(ctx.TRIANGLE_FAN, 0, numverts);

    // Disable attributes
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.disableVertexAttribArray(attriblocs[i]);
}


// drawCube
// Draw solid cube -- like glutSolidCube.
//
// ctx is WebGL context. r, g, b, a are optional arguments giving color.
// Uses standard attribute, uniform shader variable names; see comments
// @ beginning of this file.
function drawCube(ctx,
                  size,
                  r, g, b, a)
{
    // Set up parameters
    if (typeof r != 'number') r = 0.7;
    if (typeof g != 'number') g = 0.7;
    if (typeof b != 'number') b = 0.7;
    if (typeof a != 'number') a = 1.0;

    // +x face
    pushMvMatrix(ctx);
    mat4.rotate(ctx.mvMatrix, ctx.mvMatrix,
        Math.PI/180. * 90., [0., 1., 0.]);
    mat4.translate(ctx.mvMatrix, ctx.mvMatrix,
        [0., 0., size/2.]);
    drawSquare(ctx, size, r, g, b, a);
    popMvMatrix(ctx);

    // -x face
    pushMvMatrix(ctx);
    mat4.rotate(ctx.mvMatrix, ctx.mvMatrix,
        Math.PI/180. * -90., [0., 1., 0.]);
    mat4.translate(ctx.mvMatrix, ctx.mvMatrix,
        [0., 0., size/2.]);
    drawSquare(ctx, size, r, g, b, a);
    popMvMatrix(ctx);

    // +y face
    pushMvMatrix(ctx);
    mat4.rotate(ctx.mvMatrix, ctx.mvMatrix,
        Math.PI/180. * -90., [1., 0., 0.]);
    mat4.translate(ctx.mvMatrix, ctx.mvMatrix,
        [0., 0., size/2.]);
    drawSquare(ctx, size, r, g, b, a);
    popMvMatrix(ctx);

    // -y face
    pushMvMatrix(ctx);
    mat4.rotate(ctx.mvMatrix, ctx.mvMatrix,
        Math.PI/180. * 90., [1., 0., 0.]);
    mat4.translate(ctx.mvMatrix, ctx.mvMatrix,
        [0., 0., size/2.]);
    drawSquare(ctx, size, r, g, b, a);
    popMvMatrix(ctx);

    // +z face
    pushMvMatrix(ctx);
    mat4.translate(ctx.mvMatrix, ctx.mvMatrix,
        [0., 0., size/2.]);
    drawSquare(ctx, size, r, g, b, a);
    popMvMatrix(ctx);

    // -z face
    pushMvMatrix(ctx);
    mat4.rotate(ctx.mvMatrix, ctx.mvMatrix,
        Math.PI/180. * 180., [1., 0., 0.]);
    mat4.translate(ctx.mvMatrix, ctx.mvMatrix,
        [0., 0., size/2.]);
    drawSquare(ctx, size, r, g, b, a);
    popMvMatrix(ctx);
}


// drawSphere
// Draw solid sphere -- like glutSolidSphere.
//
// ctx is WebGL context. r, g, b, a are optional arguments giving color.
// Uses standard attribute, uniform shader variable names; see comments
// @ beginning of this file.
function drawSphere(ctx,
                    radius, slices, stacks,
                    r, g, b, a)
{
    // Get attribute locations
    var attriblocs = getAttribLocs(ctx);
    if (!attriblocs)
    {
        errOut(arguments.callee.name + ': ' +
               'Could not get attribute locations');
        return;
    }

    // Set up parameters
    if (typeof r != 'number') r = 0.7;
    if (typeof g != 'number') g = 0.7;
    if (typeof b != 'number') b = 0.7;
    if (typeof a != 'number') a = 1.0;

    // Create VBOs
    var buffs = new Array(5);
    var datas = new Array(5);
    for (var i = 0; i < 5; ++i)
    {
        buffs[i] = ctx.createBuffer();
        var components = (i == 2 || i == 4) ? 3 : 4;
        datas[i] = new Float32Array(components*(slices+1)*(stacks+1));
    }
    for (var i1 = 0; i1 <= stacks; ++i1)
    {
        var tc1 = i1/stacks;
        var ang1 = tc1 * Math.PI;
        for (var i2 = 0; i2 <= slices; ++i2)
        {
            var tc2 = i2/slices;
            var ang2 = tc2 * 2.*Math.PI;

            var nx = Math.cos(ang2)*Math.sin(ang1);
            var ny = Math.sin(ang2)*Math.sin(ang1);
            var nz = Math.cos(ang1);

            var b4 = 4*(i1*(slices+1) + i2);  // Base for indices
            var b3 = 3*(i1*(slices+1) + i2);

            // vertex coords
            datas[0][b4+0] = radius * nx;
            datas[0][b4+1] = radius * ny;
            datas[0][b4+2] = radius * nz;
            datas[0][b4+3] = 1.;

            // color
            datas[1][b4+0] = r;
            datas[1][b4+1] = g;
            datas[1][b4+2] = b;
            datas[1][b4+3] = a;

            // normal
            datas[2][b3+0] = nx
            datas[2][b3+1] = ny
            datas[2][b3+2] = nz

            // texture coords
            datas[3][b4+0] = tc1;
            datas[3][b4+1] = tc2;
            datas[3][b4+2] = 0.;
            datas[3][b4+3] = 1.;

            // tangent
            datas[4][b3+0] = Math.cos(ang2)*Math.cos(ang1);
            datas[4][b3+1] = Math.sin(ang2)*Math.cos(ang1);
            datas[4][b3+2] = -Math.sin(ang1);
        }
    }
    for (var i in attriblocs)
    {
        if (attriblocs[i] == -1)
            continue;
        var components = (i == 2 || i == 4) ? 3 : 4;
        ctx.bindBuffer(ctx.ARRAY_BUFFER, buffs[i]);
        ctx.bufferData(
            ctx.ARRAY_BUFFER, datas[i], ctx.STATIC_DRAW);
        ctx.vertexAttribPointer(
            attriblocs[i], components, ctx.FLOAT, false, 0, 0);
    }

    // Set up uniforms, enable attributes
    sendMatrices(ctx);
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.enableVertexAttribArray(attriblocs[i]);

    // Draw with EBO
    var ebuff = ctx.createBuffer();
    var edata = new Uint16Array(2*(slices+1));
    for (var i1 = 0; i1 < stacks; ++i1)
    {
        for (var i2 = 0; i2 <= slices; ++i2)
        {
            edata[2*i2+0] = i1*(slices+1) + i2;
            edata[2*i2+1] = (i1+1)*(slices+1) + i2;
        }

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, ebuff);
        ctx.bufferData(
            ctx.ELEMENT_ARRAY_BUFFER, edata, ctx.DYNAMIC_DRAW);
        ctx.drawElements(
            ctx.TRIANGLE_STRIP, 2*(slices+1), ctx.UNSIGNED_SHORT, 0);
    }

    // Disable attributes
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.disableVertexAttribArray(attriblocs[i]);

    // Delete buffer objects
    for (i in buffs)
        ctx.deleteBuffer(buffs[i]);
    ctx.deleteBuffer(ebuff);
}


// drawTorus
// Draw solid torus -- like glutSolidTorus.
//
// ctx is WebGL context. r, g, b, a are optional arguments giving color.
// Uses standard attribute, uniform shader variable names; see comments
// @ beginning of this file.
function drawTorus(ctx,
                   smrad, bigrad, smsubdivs, bigsubdivs,
                   r, g, b, a)
{
    // Get attribute locations
    var attriblocs = getAttribLocs(ctx);
    if (!attriblocs)
    {
        errOut(arguments.callee.name + ': ' +
               'Could not get attribute locations');
        return;
    }

    // Set up parameters
    if (typeof r != 'number') r = 0.7;
    if (typeof g != 'number') g = 0.7;
    if (typeof b != 'number') b = 0.7;
    if (typeof a != 'number') a = 1.0;

    // Create VBOs
    var buffs = new Array(5);
    var datas = new Array(5);
    for (var i = 0; i < 5; ++i)
    {
        buffs[i] = ctx.createBuffer();
        var components = (i == 2 || i == 4) ? 3 : 4;
        datas[i] = new Float32Array(components*(smsubdivs+1)*(bigsubdivs+1));
    }
    for (var i1 = 0; i1 <= bigsubdivs; ++i1)
    {
        var tc1 = i1/bigsubdivs;
        var ang1 = tc1 * 2.0*Math.PI;
        for (var i2 = 0; i2 <= smsubdivs; ++i2)
        {
            var tc2 = i2/smsubdivs;
            var ang2 = tc2 * 2.0*Math.PI;

            var b4 = 4*(i1*(smsubdivs+1) + i2);  // Base for indices
            var b3 = 3*(i1*(smsubdivs+1) + i2);

            // vertex coords
            datas[0][b4+0] =
                (bigrad+smrad*Math.cos(ang2))*Math.cos(ang1);
            datas[0][b4+1] =
                (bigrad+smrad*Math.cos(ang2))*Math.sin(ang1);
            datas[0][b4+2] =
                smrad*Math.sin(ang2);
            datas[0][b4+3] =
                1.;

            // color
            datas[1][b4+0] = r;
            datas[1][b4+1] = g;
            datas[1][b4+2] = b;
            datas[1][b4+3] = a;

            datas[2][b3+0] = Math.cos(ang2)*Math.cos(ang1);
            datas[2][b3+1] = Math.cos(ang2)*Math.sin(ang1);
            datas[2][b3+2] = Math.sin(ang2);

            // texture coords
            datas[3][b4+0] = tc1;
            datas[3][b4+1] = tc2;
            datas[3][b4+2] = 0.;
            datas[3][b4+3] = 1.;

            // tangent
            datas[4][b3+0] = -Math.sin(ang1);
            datas[4][b3+1] = Math.cos(ang1);
            datas[4][b3+2] = 0.;
        }
    }
    for (var i in attriblocs)
    {
        if (attriblocs[i] == -1)
            continue;
        var components = (i == 2 || i == 4) ? 3 : 4;
        ctx.bindBuffer(ctx.ARRAY_BUFFER, buffs[i]);
        ctx.bufferData(
            ctx.ARRAY_BUFFER, datas[i], ctx.STATIC_DRAW);
        ctx.vertexAttribPointer(
            attriblocs[i], components, ctx.FLOAT, false, 0, 0);
    }

    // Set up uniforms, enable attributes
    sendMatrices(ctx);
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.enableVertexAttribArray(attriblocs[i]);

    // Draw with EBO
    var ebuff = ctx.createBuffer();
    var edata = new Uint16Array(2*(smsubdivs+1));
    for (var i1 = 0; i1 < bigsubdivs; ++i1)
    {
        for (var i2 = 0; i2 <= smsubdivs; ++i2)
        {
            edata[2*i2+0] =
                i1*(smsubdivs+1) + i2;
            edata[2*i2+1] =
                (i1+1)*(smsubdivs+1) + i2;
        }

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, ebuff);
        ctx.bufferData(
            ctx.ELEMENT_ARRAY_BUFFER, edata, ctx.DYNAMIC_DRAW);
        ctx.drawElements(
            ctx.TRIANGLE_STRIP, 2*(smsubdivs+1), ctx.UNSIGNED_SHORT, 0);
    }

    // Disable attributes
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.disableVertexAttribArray(attriblocs[i]);

    // Delete buffer objects
    for (i in buffs)
        ctx.deleteBuffer(buffs[i]);
    ctx.deleteBuffer(ebuff);
}


// drawCylinder
// Draw a cylinder, radius 1, length 2, centered at origin, around
// x-axis. Uses given number of subdivisions.
//
// ctx is WebGL context. r, g, b, a are optional arguments giving color.
// Uses standard attribute, uniform shader variable names; see comments
// @ beginning of this file.
function drawCylinder(ctx,
                      subdivs,
                      r, g, b, a)
{
    // Get attribute locations
    var attriblocs = getAttribLocs(ctx);
    if (!attriblocs)
    {
        errOut(arguments.callee.name + ': ' +
               'Could not get attribute locations');
        return;
    }

    // Set up parameters
    if (typeof r != 'number') r = 0.7;
    if (typeof g != 'number') g = 0.7;
    if (typeof b != 'number') b = 0.7;
    if (typeof a != 'number') a = 1.0;
    var halflen = 1.;     // Half of cylinder's length
    var radius = 1.;      // Cylinder's radius
    var sd1 = subdivs;    // Subdivisions along cylinder
    var sd2 = 4*subdivs;  // Subdivisions around cylinder

    // Create VBOs

    var buffs = new Array(5);
    var datas = new Array(5);
    for (var i = 0; i < 5; ++i)
    {
        buffs[i] = ctx.createBuffer();
        var components = (i == 2 || i == 4) ? 3 : 4;
        datas[i] = new Float32Array(components*(sd2+1)*(sd1+1));
    }

    for (var i1 = 0; i1 <= sd1; ++i1)
    {
        var tc1 = i1/sd1;
        var x = halflen - tc1 * 2.*halflen;
        for (var i2 = 0; i2 <= sd2; ++i2)
        {
            var tc2 = i2/sd2;
            var ang2 = tc2 * 2.*Math.PI;
            var ny = Math.cos(ang2);
            var nz = Math.sin(ang2);

            var b4 = 4*(i1*(sd2+1) + i2);  // Base for indices
            var b3 = 3*(i1*(sd2+1) + i2);

            // vertex coords
            datas[0][b4+0] = x;
            datas[0][b4+1] = radius * ny;
            datas[0][b4+2] = radius * nz;
            datas[0][b4+3] = 1.;

            // color
            datas[1][b4+0] = r;
            datas[1][b4+1] = g;
            datas[1][b4+2] = b;
            datas[1][b4+3] = a;

            // normal
            datas[2][b3+0] = 0.;
            datas[2][b3+1] = ny;
            datas[2][b3+2] = nz;

            // texture coords
            datas[3][b4+0] = tc1;
            datas[3][b4+1] = tc2;
            datas[3][b4+2] = 0.;
            datas[3][b4+3] = 1.;

            // tangent
            datas[4][b3+0] = 1.;
            datas[4][b3+1] = 0.;
            datas[4][b3+2] = 0.;
        }
    }
    for (var i in attriblocs)
    {
        if (attriblocs[i] == -1)
            continue;
        var components = (i == 2 || i == 4) ? 3 : 4;
        ctx.bindBuffer(ctx.ARRAY_BUFFER, buffs[i]);
        ctx.bufferData(
            ctx.ARRAY_BUFFER, datas[i], ctx.STATIC_DRAW);
        ctx.vertexAttribPointer(
            attriblocs[i], components, ctx.FLOAT, false, 0, 0);
    }

    // Set up uniforms, enable attributes
    sendMatrices(ctx);
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.enableVertexAttribArray(attriblocs[i]);

    // Draw with EBO
    var ebuff = ctx.createBuffer();
    var edata = new Uint16Array(2*(sd2+1));
    for (var i1 = 0; i1 < sd1; ++i1)
    {
        for (var i2 = 0; i2 <= sd2; ++i2)
        {
            edata[2*i2+0] = i1*(sd2+1) + i2;
            edata[2*i2+1] = (i1+1)*(sd2+1) + i2;
        }

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, ebuff);
        ctx.bufferData(
            ctx.ELEMENT_ARRAY_BUFFER, edata, ctx.DYNAMIC_DRAW);
        ctx.drawElements(
            ctx.TRIANGLE_STRIP, 2*(sd2+1), ctx.UNSIGNED_SHORT, 0);
    }

    // Disable attributes
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.disableVertexAttribArray(attriblocs[i]);

    // Delete buffer objects
    for (i in buffs)
        ctx.deleteBuffer(buffs[i]);
    ctx.deleteBuffer(ebuff);
}


// drawCubeArray
// Draws 3-D array of small cubes, centered at origin, in given color.
// NEED TO SPEED THIS UP!!!
function drawCubeArray(r, g, b, a)
{
    var arraysize = 10;
    var spacing = 2.;     // Spacing of cube positions
    var halfwid = 0.125;  // Half width of cubes

    for (var i = -arraysize; i <= arraysize; ++i)
    {
        for (var j = -arraysize; j <= arraysize; ++j)
        {
            for (var k = -arraysize; k <= arraysize; ++k)
            {
                pushMvMatrix(gl);
                mat4.translate(gl.mvMatrix, gl.mvMatrix,
                    [spacing*i, spacing*j, spacing*k]);
                mat4.scale(gl.mvMatrix, gl.mvMatrix,
                    [halfwid, halfwid, halfwid]);
                drawCube(gl, 2., r, g, b, a);
                popMvMatrix(gl);
            }
        }
    }
}


// sendMatrices
// Assumes ctx has members pMatrix, mvMatrix, tMatrix that are
// glMatrix objects. Sends the three matrices to current active
// shaders: uniform mat4 variables with names projectionMatrix,
// modelViewMatrix, and textureMatrix -- if these exist in the shaders.
// Computes normal matrix and sends this to uniform mat3 variable with
// name normalMatrix -- if this exists in the shaders.
function sendMatrices(ctx)
{
    var shaderprogram =
        getProgram_I_(ctx, arguments.callee.name);
    if (!shaderprogram)
        return;

    if (!shaderprogram.uniformlocs_I_)
    {
        shaderprogram.uniformlocs_I_ = [
            ctx.getUniformLocation(shaderprogram, 'projectionMatrix'),
            ctx.getUniformLocation(shaderprogram, 'modelViewMatrix'),
            ctx.getUniformLocation(shaderprogram, 'normalMatrix'),
            ctx.getUniformLocation(shaderprogram, 'textureMatrix')
        ];
    }

    // Projection matrix
    if (shaderprogram.uniformlocs_I_[0] && ctx.pMatrix)
    {
        ctx.uniformMatrix4fv(shaderprogram.uniformlocs_I_[0],
                             false, ctx.pMatrix);
    }

    // Model/view matrix
    if (shaderprogram.uniformlocs_I_[1] && ctx.mvMatrix)
    {
        ctx.uniformMatrix4fv(shaderprogram.uniformlocs_I_[1],
                             false, ctx.mvMatrix);
    }

    // Normal matrix (compute it first)
    if (shaderprogram.uniformlocs_I_[2] && ctx.mvMatrix)
    {
        // Compute normal matrix
        var nMatrix = mat3.create();
        mat3.normalFromMat4(nMatrix, ctx.mvMatrix);

        // Send it to the shaders
        ctx.uniformMatrix3fv(shaderprogram.uniformlocs_I_[2],
                             false, nMatrix);
    }

    // Texture matrix
    if (shaderprogram.uniformlocs_I_[3] && ctx.tMatrix)
    {
        ctx.uniformMatrix4fv(shaderprogram.uniformlocs_I_[3],
                             false, ctx.tMatrix);
    }
}


// makeShaderObject_I_
// Given WebGL context, string holding GLSL source for shader, and
// Boolean indicating vertex (true) or fragment (false) shader,
// returns shader object, or null on failure.
function makeShaderObject_I_(ctx, shaderText, isVert)
{
    var shaderType = isVert ? ctx.VERTEX_SHADER : ctx.FRAGMENT_SHADER;
    var shaderStr = isVert ? 'vertex' : 'fragment';

    // Create shader object
    var shader = ctx.createShader(shaderType);
    if (!shader)
    {
        errOut(arguments.callee.name + ': ' +
               'Cannot create ' + shaderStr + ' shader object');
        return null;
    }

    // Load, compile shader source
    ctx.shaderSource(shader, shaderText);
    ctx.compileShader(shader);

    // Check compile status
    var compiled = ctx.getShaderParameter(shader, ctx.COMPILE_STATUS);
    if (!compiled)
    {
        var error = ctx.getShaderInfoLog(shader);
        errOut(arguments.callee.name + ': ' +
               'Error compiling ' + shaderStr + ' shader, msg =');
        errOut(error);
        ctx.deleteShader(shader);
        return null;
    }

    return shader;
}


// makeProgramObject
// Given WebGL context, strings holding source for GLSL vertex,
// fragment shaders, returns program object, or null on failure.
function makeProgramObject(ctx, vShaderText, fShaderText)
{
    if (!checkContext_I_(ctx, arguments.callee.name))
        return null;

    // Make shaders
    var vShader = makeShaderObject_I_(ctx, vShaderText, true);
    if (!vShader)
        return null;
    var fShader = makeShaderObject_I_(ctx, fShaderText, false);
    if (!fShader)
        return null;

    // Make program object
    var shaderprogram = ctx.createProgram();
    if (!shaderprogram)
        return null;

    // Attach shaders to program object
    ctx.attachShader(shaderprogram, vShader);
    ctx.attachShader(shaderprogram, fShader);

    // Link shaders
    ctx.linkProgram(shaderprogram);

    // Check link status
    var linked =
        ctx.getProgramParameter(shaderprogram, ctx.LINK_STATUS);
    if (!linked)
    {
        var error = ctx.getProgramInfoLog(shaderprogram);
        errOut(arguments.callee.name + ': ' +
               'shader linking error, msg =');
        errOut(error);

        ctx.deleteProgram(shaderprogram);
        ctx.deleteProgram(fShader);
        ctx.deleteProgram(vShader);

        return null;
    }

    return shaderprogram;
}


// makeProgramObjectFromIds
// Given WebGL context, strings holding element Ids for vertex, fragment
// shaders, returns program object, or null on failure.
function makeProgramObjectFromIds(ctx, vShaderId, fShaderId)
{
    if (!checkContext_I_(ctx, arguments.callee.name))
        return null;
    if (typeof vShaderId != 'string')
    {
        errOut(arguments.callee.name + ': ' +
               'Vertex shader Id not given');
        return null;
    }
    if (typeof fShaderId != 'string')
    {
        errOut(arguments.callee.name + ': ' +
               'Fragment shader Id not given');
        return null;
    }

    var vShaderScript = document.getElementById(vShaderId);
    if (!vShaderScript)
    {
        errOut(arguments.callee.name + ': ' +
               'Vertex shader script [' + vShaderId + '] not found');
        return null;
    }
    if (vShaderScript.nodeName.toLowerCase() != 'script' ||
        !vShaderScript.type ||
        vShaderScript.type != 'x-shader/x-vertex')
    {
        errOut(arguments.callee.name + ': ' +
               'Script [' + vShaderId + '] is not a vertex shader');
        return null;
    }

    var fShaderScript = document.getElementById(fShaderId);
    if (!fShaderScript)
    {
        errOut(arguments.callee.name + ': ' +
               'Vertex shader script [' + fShaderId + '] not found');
        return null;
    }
    if (fShaderScript.nodeName.toLowerCase() != 'script' ||
        !fShaderScript.type ||
        fShaderScript.type != 'x-shader/x-fragment')
    {
        errOut(arguments.callee.name + ': ' +
               'Script [' + fShaderId + '] is not a fragment shader');
        return null;
    }

    return makeProgramObject(ctx,
                             vShaderScript.text, fShaderScript.text);
}


// getCanvas
// Given Id of canvas element, returns canvas object, or null if
// failure.
function getCanvas(canvasId)
{
    if (typeof canvasId != 'string')
    {
        errOut(arguments.callee.name + ': ' +
               'Canvas Id not given');
        return null;
    }

    var canvas = document.getElementById(canvasId);
    if (!canvas)
    {
        errOut(arguments.callee.name + ': ' +
               'Canvas [' + canvasId + '] not found');
        return null;
    }
    if (canvas.nodeName.toLowerCase() != 'canvas')
    {
        errOut(arguments.callee.name + ': ' +
               'Elements [' + canvasId + '] is not a canvas');
        return null;
    }

    return canvas;
}


// pushPMatrix, pushMvMatrix, pushTMatrix
// In the given context, push the appropriate matrix (pMatrix, mvMatrix,
// or tMatrix) on the associated stack.
// Assumes context has members pMatrix and pStack_I_ (and similar
// members for mv, t).
function pushPMatrix(ctx)
{
    ctx.pStack_I_.push(mat4.clone(ctx.pMatrix));
}

function pushMvMatrix(ctx)
{
    ctx.mvStack_I_.push(mat4.clone(ctx.mvMatrix));
}

function pushTMatrix(ctx)
{
    ctx.tStack_I_.push(mat4.clone(ctx.tMatrix));
}


// popPMatrix, popMvMatrix, popTMatrix
// In the given context, pop the appropriate matrix (pMatrix, mvMatrix,
// or tMatrix) off the associated stack. Gives error message if called
// with empty stack.
// Assumes context has members pMatrix and pStack_I_ (and similar
// members for mv, t).
function popPMatrix(ctx)
{
    if (ctx.pStack_I_.length == 0)
    {
        errOut(arguments.callee.name + ': ' +
               'Projection matrix stack popped when empty');
        return;
    }
    mat4.copy(ctx.pMatrix, ctx.pStack_I_.pop());
}

function popMvMatrix(ctx)
{
    if (ctx.mvStack_I_.length == 0)
    {
        errOut(arguments.callee.name + ': ' +
               'Model/view matrix stack popped when empty');
        return;
    }
    mat4.copy(ctx.mvMatrix, ctx.mvStack_I_.pop());
}

function popTMatrix(ctx)
{
    if (ctx.tStack_I_.length == 0)
    {
        errOut(arguments.callee.name + ': ' +
               'Texture matrix stack popped when empty');
        return;
    }
    mat4.copy(ctx.tMatrix, ctx.tStack_I_.pop());
}


// getGlContext_I_
// Given canvas object, returns WebGL context, or null on failure.
// Returned context has the following members added:
// - glMatrix mat4 matrices:
//   - mvMatrix, pMatrix, tMatrix
// - Matrix stacks stored as arrays (access via push, pop functions):
//   - pStack_I_, mvStack_I_, tStack_I_
function getGlContext_I_(canvas)
{
    // Is the parameter actually a canvas element? Exit if not.
    if (typeof canvas != 'object' ||
        !('nodeName' in canvas) ||
        typeof canvas.nodeName != 'string' ||
        canvas.nodeName.toLowerCase() != 'canvas')
    {
        errOut(arguments.callee.name + ': ' +
               'Canvas object not given');
        return null;
    }

    // Get WebGL rendering context from canvas. Exit on error.
    var ctx = null;
    try
    {
        // Below based on webgl-utils.js from Google
        var webglnames = ['webgl',
                          'experimental-webgl',
                          'webkit-3d',
                          'moz-webgl'];
        for (var i in webglnames)
        {
            ctx = canvas.getContext(webglnames[i]);
            // NOTE: In some browsers, the above gives an error even
            // though everything is actually fine.

            if (ctx)
                break;  // Got context, so stop looking for one
        }
    }
    catch (e) {}
    // Exceptions get messy; ignore them in this case. Instead, check
    // for errors by seeing whether ctx is null.
    if (!ctx)
    {
        var errmsg = 'Could not initialize WebGL' +
                     '<br>Browser too old?' +
                     '<br>Graphics hardware too wimpy?';
        document.write(errmsg);
        errOut(arguments.callee.name + ': ' + errmsg);
        return null;
    }

    // Create projection, model/view, texture matrices as ctx members
    // initialized to identitiy matrices.
    ctx.pMatrix = mat4.create();
    ctx.mvMatrix = mat4.create();
    ctx.tMatrix = mat4.create();

    // Create projection, model/view, texture stacks as ctx members
    // initialized to empty -- so current transformation matrix has
    // nothing below it on the stack.
    ctx.pStack_I_ = new Array();
    ctx.mvStack_I_ = new Array();
    ctx.tStack_I_ = new Array();

    // Done; return fully initialized context.
    return ctx;
}


// requestAnimFrame_I_
// Returns function window.requestAnimationFrame, or, if that does not
// exist, a function that does much the same thing.
// Based on webgl-utils.js from Google.
requestAnimFrame_I_ = (function()
{
    return window.requestAnimationFrame ||
           window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame ||
           window.oRequestAnimationFrame ||
           window.msRequestAnimationFrame ||
           function(callback, element)
           {
                 window.setTimeout(callback, 1000/60);
           };
})();


// animate_I_
// Given function to call, does repeated animation frames, calling the
// given function at each frame.
function animate_I_(func)
{
    // Are we given a function?
    if (typeof func != 'function')
    {
        errOut(arguments.callee.name + ': ' +
               'Argument is not a function');
        return;
    }

    // Set up next frame: call this function with same argument.
    var thisfunc = arguments.callee;
    requestAnimFrame_I_(function() { thisfunc(func); });

    // Call given function
    func();
}


// Legacy-like interface to WebGL primitives
//
// This implements roughly the old glBegin-glEnd drawing method.
//
// Call primBegin, passing a context and a constant identifying a
// primitive. Then do any number of primVertex calls, preceded by
// primColor, primNormal, primTexCoord, and/or primTanVec calls to set
// attributes. Finish by calling primEnd with the context.
//
// The context should be one returned by quollInit.
//
// Example: ('gl' is the context)
//
//   primBegin(gl, gl.LINES);
//   primColor(gl, 1., 0., 0.);
//   primVertex(gl, 0., 0., 0.);
//   primColor(gl, 0., 1., 0.);
//   primVertex(gl, 1., 0., 0.);
//   primEnd(gl);


// Globals

// Should these go in the rendering context? (!!!)
// These are initialized in quollInit.

// States for attributes
var prim_color_I_;        // Current color (4 components)
var prim_normal_I_;       // Current normal (3 components)
var prim_texcoord_I_;     // Current texture coordinates (4 components)
var prim_tanvec_I_;       // Current tangent vector (3 components)

// primBegin-primEnd handling
var prim_creating_I_;     // Boolean: inside primBegin-primEnd?
                          // Following are only valid if this is true
var prim_which_I_;        // WebGL constant identifying primitive
var prim_numverts_I_;     // How many vertices so far
var prim_data_I_;         // Data for primitive, so far


// primBegin
// Start a primitive. Can be called only when we are not currently
// creating a primitive.
function primBegin(ctx, prim)
{
    if (prim_creating_I_)
    {
        errOut(arguments.callee.name + ': ' +
               'Called between primBegin, primEnd');
        return;
    }
    if (!checkContext_I_(ctx, arguments.callee.name))
    {
        return;
    }
    if ((prim != ctx.POINTS)
     && (prim != ctx.LINES)
     && (prim != ctx.LINE_STRIP)
     && (prim != ctx.LINE_LOOP)
     && (prim != ctx.TRIANGLES)
     && (prim != ctx.TRIANGLE_STRIP)
     && (prim != ctx.TRIANGLE_FAN))
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal primitive');
        return;
    }

    prim_creating_I_ = true;
    prim_which_I_ = prim;
    prim_numverts_I_ = 0;
    prim_data_I_ = [];
}


// primVertex
// Set vertex coordinates and stores vertex with current attributes.
// Parameters z, w are optional.
function primVertex(ctx, x, y, z, w)
{
    if (!prim_creating_I_)
    {
        errOut(arguments.callee.name + ': ' +
               'Called without calling primBegin first');
        return;
    }
    if (!checkContext_I_(ctx, arguments.callee.name))
    {
        return;
    }

    // Check for illegal parameters
    if (typeof x != 'number')
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal x value');
        return;
    }
    if (typeof y != 'number')
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal y value');
        return;
    }
    if (typeof z != 'number') z = 0.;
    if (typeof w != 'number') w = 1.;

    // Add new vertex
    prim_data_I_.push(x);
    prim_data_I_.push(y);
    prim_data_I_.push(z);
    prim_data_I_.push(w);
    prim_data_I_.push(prim_color_I_[0]);
    prim_data_I_.push(prim_color_I_[1]);
    prim_data_I_.push(prim_color_I_[2]);
    prim_data_I_.push(prim_color_I_[3]);
    prim_data_I_.push(prim_normal_I_[0]);
    prim_data_I_.push(prim_normal_I_[1]);
    prim_data_I_.push(prim_normal_I_[2]);
    prim_data_I_.push(prim_texcoord_I_[0]);
    prim_data_I_.push(prim_texcoord_I_[1]);
    prim_data_I_.push(prim_texcoord_I_[2]);
    prim_data_I_.push(prim_texcoord_I_[3]);
    prim_data_I_.push(prim_tanvec_I_[0]);
    prim_data_I_.push(prim_tanvec_I_[1]);
    prim_data_I_.push(prim_tanvec_I_[2]);
    ++prim_numverts_I_;
}


// primColor
// Set color state.
// Parameter a is optional.
function primColor(ctx, r, g, b, a)
{
    if (!checkContext_I_(ctx, arguments.callee.name))
    {
        return;
    }

    // Check for illegal parameters
    if (typeof r != 'number')
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal r value');
        return;
    }
    if (typeof g != 'number')
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal g value');
        return;
    }
    if (typeof b != 'number')
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal b value');
        return;
    }
    if (typeof a != 'number') a = 1.0;

    // Clamp parameters to [0., 1.]
    if (r < 0.) r = 0.;
    if (r > 1.) r = 1.;
    if (g < 0.) g = 0.;
    if (g > 1.) g = 1.;
    if (b < 0.) b = 0.;
    if (b > 1.) b = 1.;
    if (a < 0.) a = 0.;
    if (a > 1.) a = 1.;

    // Set state
    prim_color_I_ = [r, g, b, a];
}


// primNormal
// Set normal state.
function primNormal(ctx, x, y, z)
{
    if (!checkContext_I_(ctx, arguments.callee.name))
    {
        return;
    }

    // Check for illegal parameters
    if (typeof x != 'number')
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal x value');
        return;
    }
    if (typeof y != 'number')
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal y value');
        return;
    }
    if (typeof z != 'number')
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal z value');
        return;
    }

    // Set state
    prim_normal_I_ = [x, y, z];
}


// primTexCoord
// Set texture coordinate state.
// Parameters y, z, w are optional.
function primTexCoord(ctx, x, y, z, w)
{
    if (!checkContext_I_(ctx, arguments.callee.name))
    {
        return;
    }

    // Check for illegal parameters
    if (typeof x != 'number')
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal x value');
        return;
    }
    if (typeof y != 'number') y = 0.;
    if (typeof z != 'number') z = 0.;
    if (typeof w != 'number') w = 1.;

    // Set state
    prim_texcoord_I_ = [x, y, z, w];
}


// primTanVec
// Set tangent vector state.
function primTanVec(ctx, x, y, z)
{
    if (!checkContext_I_(ctx, arguments.callee.name))
    {
        return;
    }

    // Check for illegal parameters
    if (typeof x != 'number')
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal x value');
        return;
    }
    if (typeof y != 'number')
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal y value');
        return;
    }
    if (typeof z != 'number')
    {
        errOut(arguments.callee.name + ': ' +
               'Illegal z value');
        return;
    }

    // Set state
    prim_tanvec_I_ = [x, y, z];
}


// primEnd
// Ends current primitive and renders it.
function primEnd(ctx)
{
    if (!prim_creating_I_)
    {
        errOut(arguments.callee.name + ': ' +
               'Called without calling primBegin first');
        return;
    }
    if (prim_data_I_.length != prim_numverts_I_*18)
    {
        errOut(arguments.callee.name + ': ' +
               'Size mismatch in data for primitive');
        return;
    }
    if (!checkContext_I_(ctx, arguments.callee.name))
    {
        return;
    }

    // Get attribute locations
    var attriblocs = getAttribLocs(ctx);
    if (!attriblocs)
    {
        errOut(arguments.callee.name + ': ' +
               'Could not get attribute locations');
        return;
    }

    // Create VBOs
    var buffs = new Array(5);
    var datas = new Array(5);
    for (var i = 0; i < 5; ++i)
    {
        buffs[i] = ctx.createBuffer();
        var components = (i == 2 || i == 4) ? 3 : 4;
        datas[i] = new Float32Array(components*prim_numverts_I_);
    }
    for (var i = 0; i < prim_numverts_I_; ++i)
    {
        var b4 = 4*i;  // Base for indices
        var b3 = 3*i;
        var b18 = 18*i;

        // vertex coords
        datas[0][b4+0] = prim_data_I_[b18+0];
        datas[0][b4+1] = prim_data_I_[b18+1];
        datas[0][b4+2] = prim_data_I_[b18+2];
        datas[0][b4+3] = prim_data_I_[b18+3];

        // color
        datas[1][b4+0] = prim_data_I_[b18+4];
        datas[1][b4+1] = prim_data_I_[b18+5];
        datas[1][b4+2] = prim_data_I_[b18+6];
        datas[1][b4+3] = prim_data_I_[b18+7];

        // normal
        datas[2][b3+0] = prim_data_I_[b18+8];
        datas[2][b3+1] = prim_data_I_[b18+9];
        datas[2][b3+2] = prim_data_I_[b18+10];

        // texture coords
        datas[3][b4+0] = prim_data_I_[b18+11];
        datas[3][b4+1] = prim_data_I_[b18+12];
        datas[3][b4+2] = prim_data_I_[b18+13];
        datas[3][b4+3] = prim_data_I_[b18+14];

        // tangent
        datas[4][b3+0] = prim_data_I_[b18+15];
        datas[4][b3+1] = prim_data_I_[b18+16];
        datas[4][b3+2] = prim_data_I_[b18+17];
    }
    for (var i in attriblocs)
    {
        if (attriblocs[i] == -1)
            continue;
        var components = (i == 2 || i == 4) ? 3 : 4;
        ctx.bindBuffer(ctx.ARRAY_BUFFER, buffs[i]);
        ctx.bufferData(
            ctx.ARRAY_BUFFER, datas[i], ctx.STATIC_DRAW);
        ctx.vertexAttribPointer(
            attriblocs[i], components, ctx.FLOAT, false, 0, 0);
    }

    // Set up uniforms, enable attributes
    sendMatrices(ctx);
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.enableVertexAttribArray(attriblocs[i]);

    // Draw with VBO
    ctx.drawArrays(prim_which_I_, 0, prim_numverts_I_);

    // Disable attributes
    for (var i in attriblocs)
        if (attriblocs[i] != -1)
            ctx.disableVertexAttribArray(attriblocs[i]);

    // Delete buffer objects
    for (i in buffs)
        ctx.deleteBuffer(buffs[i]);

    // We're done with this primitive
    prim_creating_I_ = false;
}


// What follows is kind of a mini-GLUT
//
// Call quollInit(canvasId) to start up the app (on document load?).
// This returns an initialized WebGL context, which should be saved for
// later use, or null on failure to initialize.
//
// To post a redisplay event, call postRedisplay()
//
// To register a display, idle, or canvas-reshape callback function,
// call, respectively: registerDisplay, registerIdle, registerReshape,
// passing/ the callback function. Callbacks should take no parameters.
//
// Other functions:
//
// canvasFullWindow
// - Pass true to this to set the canvas to be the entire window -- and
//   keep setting it whenever the window is resized. Pass false to stop
//   doing this. canvasFullWindow(false) does NOT change the size of the
//   canvas.
//
// keyFromEvent
// - Pass a keypress event object received by a callback. Return value
//   is String giving key pressed, or null if none/error.


// Globals
var canvas_I_;            // Our canvas
var cwidth_I_;            // Canvas width (pixels)
var cheight_I_;           // Canvas height (pixels)
var canvas_fullwin_I_;    // Boolean: canvas full-window flag
var redisplay_needed_I_;  // Boolean: true if redisplay needed
var display_callback_I_;  // The display callback
var idle_callback_I_;     // The idle callback
var reshape_callback_I_;  // The canvas-reshape callback


// doFrame_I_
// Should be called repeatedly. Calls idle callback and, if needed,
// canvas-reshape and display callbacks.
function doFrame_I_()
{
    // Idle
    if (typeof(idle_callback_I_) == 'function')
        idle_callback_I_();

    // Exit if we do not have a display function yet
    // (So reshape callback is called on 1st display.)
    if (typeof(display_callback_I_) != 'function')
    {
        return;
    }

    // Canvas reshape if necessary
    if (canvas_I_.width != cwidth_I_ || canvas_I_.height != cheight_I_)
    {
        cwidth_I_ = canvas_I_.width;
        cheight_I_ = canvas_I_.height;
        if (typeof(reshape_callback_I_) == 'function')
        {
            reshape_callback_I_(cwidth_I_, cheight_I_);
        }
        postRedisplay();
    }

    // Display if necessary
    if (redisplay_needed_I_)
    {
        redisplay_needed_I_ = false;

        // We already know display_callback_I_ is a function
        display_callback_I_();
    }
}


// sizeCanvas_I_
// Set canvas to fill the window, if canvas full-window flag is set.
function sizeCanvas_I_()  // Possible event argument is ignored
{
    // Make our canvas fill the window
    if (canvas_fullwin_I_)
    {
        canvas_I_.width = window.innerWidth;
        canvas_I_.height = window.innerHeight;
    }
}


// keyFromEvent
// Given an event object, hopefully representing a keypress event,
// return the key pressed, as a String, or null if none/error.
function keyFromEvent(evt)
{
    // Get character code from event
    var charCode = evt.which || evt.charCode || evt.keyCode;

    // Get key as String: ch
    var ch;
    if (typeof(charCode) == 'number')
    {
        var ch = String.fromCharCode(evt.charCode);
    }

    // Done, return key, or null if none.
    return ch;
}


// registerDisplay
// Given a function, register it as the display callback.
function registerDisplay(displayfunc)
{
    display_callback_I_ = displayfunc;
}


// registerIdle
// Given a function, register it as the idle callback.
function registerIdle(idlefunc)
{
    idle_callback_I_ = idlefunc;
}


// registerReshape
// Given a function, register it as the canvas-reshape callback. (Also,
// call the callback and post a redisplay.)
function registerReshape(reshapefunc)
{
    reshape_callback_I_ = reshapefunc;
    if (typeof(reshape_callback_I_) == 'function')
    {
        reshape_callback_I_(cwidth_I_, cheight_I_);
    }
    postRedisplay();
}


// canvasFullWindow
// Given true/false. If true, sets canvas to will the window. If false,
// STOP setting canvas to fill the window -- but do not change the size
// of the canvas here.
function canvasFullWindow(flag)
{
    if (typeof(flag) != 'boolean')
    {
        errOut('setCanvasFullWindow: not given Boolean parameter');
        return;
    }

    canvas_fullwin_I_ = flag;
    sizeCanvas_I_();
}


// quollInit
// Initialize quoll.js.
// Takes ID of canvas element. Returns initialized WebGL context, or
// null on failure.
function quollInit(canvasId)
{
    // Get canvas element, WebGL context; exit on error
    canvas_I_ = getCanvas(canvasId);
    var ctx = getGlContext_I_(canvas_I_);
    if (!ctx)
    {
        errOut('Could not get WebGL rendering context');
        return null;
    }

    // Handle canvas size issues
    canvas_fullwin_I_ = false;  // We do not make canvas fill the window
    registerReshape(function(w,h) { ctx.viewport(0, 0, w, h); });
                                // Default canvas-reshape function
    sizeCanvas_I_();            // Set canvas size IF canvas fill-window
                                //  flag is set (IT ISN'T!)
    window.addEventListener('resize', sizeCanvas_I_, false);
                                // Call above function on window resize

    // Start up main loop, which calls idle/reshape/display callbacks.
    redisplay_needed_I_ = true;
    animate_I_(doFrame_I_);

    // Set up states for legacy interface
    prim_color_I_ = [0., 0., 0., 1.];
    prim_normal_I_ = [0., 0., 1.];
    prim_texcoord_I_ = [0., 0., 0., 1.];
    prim_tanvec_I_ = [1., 0., 0.];
    prim_creating_I_ = false;

    // Return WebGL context
    return ctx;
}


// postRedisplay
// Post a redisplay event (much like glutPostRedisplay)
function postRedisplay()
{
    redisplay_needed_I_ = true;
}

