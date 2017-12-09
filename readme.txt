Sam Erie
serie@alaska.edu

Aisha Peters

space.html builds on previous homeworks and the topics were star-like particles throughout the scene, and procedurally generated textures on planets in the scene.

The planets textures consist of a heightmap for the terrain, and a second heightmap for the atmosphere. planetShader handles terrain, and atmosShader handles atmosphere. Heightmaps are made using perlin noise library written by Dr. Chappell. Terrain uses fnoise, atmosphere uses 1/f noise with greater frequency to give the clouds a more realistic appearance. The heightmaps are mapped to colors in their respective shaders. Planets are mapped with a mix from dark blue up to lighter blue on range [0., 0.5, then dark green up to lighter green on range [0.5, 1.]. Atmospheres are all white, with an alpha channel on the range [0., 1.]. This required the use of blending when atmosphere is drawn, which requires enabling blending, setting blend function and stopping from writing to the depth buffer. 
Useful functions for planets, are their shaders, function drawPlanet(planet), function genHeightMap(size), and other nearby functions depending on your level of curiosity.
