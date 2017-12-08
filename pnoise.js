// pnoise.js
// Glenn G. Chappell
// 4 Dec 2017
//
// For CS F381 / CSCE A385 Fall 2017
// Perlin-ish Noise Functions for Procedural Texture
// Based on work of K. Perlin


// pnoise_id
// Identity function.
//
// This is primarily intended as a filter function for filterfnoise*.
function pnoise_id(t)
{
    return t;
}


// pnoise_abs
// Absolute-value function.
//
// This is primarily intended as a filter function for filterfnoise*.
function pnoise_abs(t)
{
    return Math.abs(t);
}


// pnoise_mod
// Given integers a, b, with b > 0, computes a mod b.
// For those who don't know what "mod" means (like the designers of many
// computer languages): a mod b is nonnegative when b is positive. So,
// for example, (-1) mod 3 = 2.
// (No, I don't feel bitter about this; why do you ask? -GGC-)
function pnoise_mod(a, b)
{
    if (a >= 0)
        return a % b;
    else
    {
        var c = (-a) % b;
        return (c == 0) ? 0 : b-c;
    }
}


// pnoise3d
// Set given data to Perlin-ish noise.
function pnoise3d(
    data,                   // the 3-D array
    dimx, dimy, dimz,       // array dims (integers)
    freqx, freqy, freqz,    // "frequencies" (integers)
    scale,                  // "amplitude" (float - optional)
    shiftx, shifty, shiftz) // phase shifts (float - optional)
{
    if (typeof scale != 'number')
        scale = 1.;
    if (typeof shiftx != 'number')
        shiftx = 0.;
    if (typeof shifty != 'number')
        shifty = 0.;
    if (typeof shiftz != 'number')
        shifty = 0.;

    clear3d(data, dimx, dimy, dimz);
    addpnoise3d_I_(
        data,
        dimx, dimy, dimz,
        freqx, freqy, freqz,
        scale,
        shiftx+dimx/(freqx*2),
        shifty+dimy/(freqy*2),
        shiftz+dimz/(freqz*2));     // For consistency w/ fnoise
}


// fnoise3d
// Set given data to pseudo-1/f-noise.
function fnoise3d(
    data,                   // the 3-D array
    dimx, dimy, dimz,       // array dims (integers)
    freqx, freqy, freqz,    // "frequencies" (integers)
    scaleratio,             // scale mult'd by this (float - optional)
    scale,                  // "amplitude" (float - optional)
    shiftx, shifty, shiftz) // phase shifts (float - optional)
{
    if (typeof scaleratio != 'number')
        scaleratio = 0.5;
    if (typeof scale != 'number')
        scale = 1.;
    if (typeof shiftx != 'number')
        shiftx = 0.;
    if (typeof shifty != 'number')
        shifty = 0.;
    if (typeof shiftz != 'number')
        shifty = 0.;

    clear3d(data, dimx, dimy, dimz);
    var m = 1.;           // multiplier for frequency
    var sf = scaleratio;  // scale factor (multiplier for scale)
    while (freqx*m<=dimx || freqy*m<=dimy || freqz*m<=dimz)
    {
        addpnoise3d_I_(
            data,
            dimx, dimy, dimz,
            m*freqx, m*freqy, m*freqz,
            sf*scale,
            shiftx+dimx/(freqx*m*2),
            shifty+dimy/(freqy*m*2),
            shiftz+dimz/(freqz*m*2));
        m *= 2;
        sf *= scaleratio;
    }
}


// filterpnoise3d
// Set given data to Perlin-ish noise, each value passed thru given
// filter function.
function filterpnoise3d(
    data,                   // the 3-D array
    dimx, dimy, dimz,       // array dims (integers)
    freqx, freqy, freqz,    // "frequencies" (integers)
    filter,                 // filter (function - optional)
    scale,                  // "amplitude" (float - optional)
    shiftx, shifty, shiftz) // phase shifts (float - optional)
{
    if (typeof filter != 'function')
        filter = pnoise_abs;
    if (typeof scale != 'number')
        scale = 1.;
    if (typeof shiftx != 'number')
        shiftx = 0.;
    if (typeof shifty != 'number')
        shifty = 0.;
    if (typeof shiftz != 'number')
        shifty = 0.;

    clear3d(data, dimx, dimy, dimz);
    addpnoise3d_I_(
        data,
        dimx, dimy, dimz,
        freqx, freqy, freqz,
        scale,
        shiftx+dimx/(freqx*2),
        shifty+dimy/(freqy*2),
        shiftz+dimz/(freqz*2));     // For consistency w/ fnoise
    filter3d(data, dimx, dimy, dimz, filter);
}


// filterfnoise3d
// Set given data to sum of Perlin-ish noise values, each Perlin-ish
// noise value passed thru given filter function.
function filterfnoise3d(
    data,                   // the 3-D array
    dimx, dimy, dimz,       // array dims (integers)
    freqx, freqy, freqz,    // "frequencies" (integers)
    filter,                 // filter (function - optional)
    scaleratio,             // scale mult'd by this (float - optional)
    scale,                  // "amplitude" (float - optional)
    shiftx, shifty, shiftz) // phase shifts (float - optional)
{
    if (typeof filter != 'function')
        filter = pnoise_abs;
    if (typeof scaleratio != 'number')
        scaleratio = 0.5;
    if (typeof scale != 'number')
        scale = 1.;
    if (typeof shiftx != 'number')
        shiftx = 0.;
    if (typeof shifty != 'number')
        shifty = 0.;
    if (typeof shiftz != 'number')
        shifty = 0.;

    clear3d(data, dimx, dimy, dimz);
    var tempdata = new Array(dimx*dimy*dimz);
    var m = 1.;           // multiplier for frequency
    var sf = scaleratio;  // scale factor (multiplier for scale)
    while (freqx*m<=dimx || freqy*m<=dimy || freqz*m<=dimz)
    {
        filterpnoise3d(
            tempdata,
            dimx, dimy, dimz,
            m*freqx, m*freqy, m*freqz,
            filter,
            sf*scale,
            shiftx+dimx/(freqx*m*2),
            shifty+dimy/(freqy*m*2),
            shiftz+dimz/(freqz*m*2));
        for (var i=0; i<dimx*dimy*dimz; ++i)
            data[i] += tempdata[i];
        m *= 2;
        sf *= scaleratio;
    }
}


// normalize3d
// Given data, normalize it, appling v -> av+b to each value, with
// a, b chosen so that the new values have mean 0 and are scaled to
// be as large as possible, while all lying in [-1,1].
function normalize3d(
    data,                   // the 3-D array
    dimx, dimy, dimz)       // array dims (integers)
{
    var max = data[0];
    var min = data[0];
    var sum = data[0];

    var size = dimx * dimy * dimz;
    for (var i=1; i<size; ++i)
    {
        if (data[i] > max) max = data[i];
        if (data[i] < min) min = data[i];
        sum += data[i];
    }

    var avg = sum/size;
    var amp = max-avg;
    if (avg-min > amp) amp = avg-min;
    if (amp == 0.) amp = 1.;

    for (var i=0; i<size; ++i)
    {
        data[i] = (data[i]-avg)/amp;
    }
}


// pnoise2d
// 2-D version of pnoise3d
function pnoise2d(
    data,           // the 2-D array
    dimx, dimy,     // array dims (integers)
    freqx, freqy,   // "frequencies" (integers)
    scale,          // "amplitude" (float - optional)
    shiftx, shifty) // phase shifts (float - optional)
{
    if (typeof scale != 'number')
        scale = 1.;
    if (typeof shiftx != 'number')
        shiftx = 0.;
    if (typeof shifty != 'number')
        shifty = 0.;

    pnoise3d(data,
             dimx, dimy, 1,
             freqx, freqy, 1.,
             scale,
             shiftx, shifty, 0.);
}


// fnoise2d
// 2-D version of fnoise3d
function fnoise2d(
    data,            // the 2-D array
    dimx, dimy,      // array dims (integers)
    freqx, freqy,    // "frequencies" (integers)
    scaleratio,      // scale mult'd by this (float - optional)
    scale,           // "amplitude" (float - optional)
    shiftx, shifty)  // phase shifts (float - optional)
{
    if (typeof scaleratio != 'number')
        scaleratio = 0.5;
    if (typeof scale != 'number')
        scale = 1.;
    if (typeof shiftx != 'number')
        shiftx = 0.;
    if (typeof shifty != 'number')
        shifty = 0.;

    fnoise3d(data,
             dimx, dimy, 1,
             freqx, freqy, 1.,
             scaleratio,
             scale,
             shiftx, shifty, 0.);
}


// filterpnoise2d
// 2-D version of fnoise3d
function filterpnoise2d(
    data,             // the 2-D array
    dimx, dimy,       // array dims (integers)
    freqx, freqy,     // "frequencies" (integers)
    filter,           // filter (function - optional)
    scale,            // "amplitude" (float - optional)
    shiftx, shifty)   // phase shifts (float - optional)
{
    if (typeof filter != 'function')
        filter = pnoise_abs;
    if (typeof scale != 'number')
        scale = 1.;
    if (typeof shiftx != 'number')
        shiftx = 0.;
    if (typeof shifty != 'number')
        shifty = 0.;

    filterpnoise3d(data,
                   dimx, dimy, 1,
                   freqx, freqy, 1.,
                   filter,
                   scale,
                   shiftx, shifty, 0.);
}


// filterfnoise2d
// 2-D version of filterfnoise3d
function filterfnoise2d(
    data,             // the 2-D array
    dimx, dimy,       // array dims (integers)
    freqx, freqy,     // "frequencies" (integers)
    filter,           // filter (function - optional)
    scaleratio,       // scale mult'd by this (float - optional)
    scale,            // "amplitude" (float - optional)
    shiftx, shifty)   // phase shifts (float - optional)
{
    if (typeof filter != 'function')
        filter = pnoise_abs;
    if (typeof scaleratio != 'number')
        scaleratio = 0.5;
    if (typeof scale != 'number')
        scale = 1.;
    if (typeof shiftx != 'number')
        shiftx = 0.;
    if (typeof shifty != 'number')
        shifty = 0.;

    filterfnoise3d(data,
                   dimx, dimy, 1,
                   freqx, freqy, 1.,
                   filter,
                   scaleratio,
                   scale,
                   shiftx, shifty, 0.);
}


// normalize2d
// 2-D version of normalize3d
function normalize2d(
    data,             // the 2-D array
    dimx, dimy)       // array dims (integers)
{
    normalize3d(data,
                dimx, dimy, 1);
}


// pnoise_fade_I_
// Returns Perlin's S-shaped fade curve.
// Valid for t in [-1.,1.].
function pnoise_fade_I_(t)
{
    var u = (t >= 0) ? 1-t : 1+t;
    return u*u*u*(u*(u*6-15)+10);
}


// addpnoise3d_I_
// Add Perlin-ish noise to given data.
function addpnoise3d_I_(
    data,                    // the 3-D array
    dimx, dimy, dimz,        // array dims (integers)
    freqx, freqy, freqz,     // "frequencies" (integers)
    scale,                   // "amplitude" (float)
    shiftx, shifty, shiftz)  // phase shifts (floats)
{
    var wlenx = dimx / freqx;  // "wavelengths"
    var wleny = dimy / freqy;
    var wlenz = dimz / freqz;

    var xwhichs = new Array();
    var ywhichs = new Array();
    var zwhichs = new Array();

    for (var wx = 0; wx < freqx; ++wx)
    {
        var centerx = wlenx * wx + shiftx;
        var lo = Math.floor(centerx - wlenx + 1);
        var hi = Math.floor(centerx + wlenx);
        if (hi >= lo)
            xwhichs.push(wx);
    }
    for (var wy = 0; wy < freqy; ++wy)
    {
        var centery = wleny * wy + shifty;
        var lo = Math.floor(centery - wleny + 1);
        var hi = Math.floor(centery + wleny);
        if (hi >= lo)
            ywhichs.push(wy);
    }
    for (var wz = 0; wz < freqz; ++wz)
    {
        var centerz = wlenz * wz + shiftz;
        var lo = Math.floor(centerz - wlenz + 1);
        var hi = Math.floor(centerz + wlenz);
        if (hi >= lo)
            zwhichs.push(wz);
    }

    for (i in xwhichs)
    {
    var centerx = wlenx * xwhichs[i] + shiftx;
    for (j in ywhichs)
    {
    var centery = wleny * ywhichs[j] + shifty;
    for (k in zwhichs)
    {
    var centerz = wlenz * zwhichs[k] + shiftz;

        // Choose random vector, len = sqrt(2)
        var vx = 0;
        var vy = 0;
        var vz = 0;
        var r = Math.floor(Math.random() * 12);

        if (r < 8)
            vx = (r & 1) ? -1 : 1;
        else
            vy = (r & 1) ? -1 : 1;
        if (r < 4)
            vy = (r & 2) ? -1 : 1;
        else
            vz = (r & 2) ? -1 : 1;

        for (var ix = Math.floor(centerx-wlenx+1);
             ix <= Math.floor(centerx + wlenx);
             ++ix)
        {
            var tx = (ix - centerx) / wlenx;
            var fadex = pnoise_fade_I_(tx);
            var coordx = pnoise_mod(ix, dimx);
            for (var iy = Math.floor(centery-wleny+1);
                 iy <= Math.floor(centery + wleny);
                 ++iy)
            {
                var ty = (iy - centery) / wleny;
                var fadey = pnoise_fade_I_(ty);
                var coordy = pnoise_mod(iy, dimy);
                for (var iz = Math.floor(centerz-wlenz+1);
                     iz <= Math.floor(centerz + wlenz);
                     ++iz)
                {
                    var tz = (iz - centerz) / wlenz;
                    var fadez = pnoise_fade_I_(tz);
                    var coordz = pnoise_mod(iz, dimz);

                    var dot = tx*vx + ty*vy + tz*vz;
                    var fade = fadex * fadey * fadez;
                    data[coordx*dimy*dimz + coordy*dimz + coordz]
                        += dot * fade * scale;
                }
            }
        } // End ix/y/z for loops

    }}} // End x/y/zwhichs loops
}


// clear3d
// Set given data to 0.
function clear3d(
    data,              // the 3-D array
    dimx, dimy, dimz)  // array dims
{
    var size = dimx * dimy * dimz;

    if (data.length != size)
    {
        alert('clear3d: array of wrong size passed');
        return;
    }

    for (var i=0; i<size; ++i)
         data[i] = 0.;
}


// filter3d
// Send all values in given array through filter function.
function filter3d(
    data,             // the 3-D array
    dimx, dimy, dimz, // array dims
    filter)           // filter function
{
    var size = dimx*dimy*dimz;
    for (var i=0; i<size; ++i)
         data[i] = filter(data[i]);
}

