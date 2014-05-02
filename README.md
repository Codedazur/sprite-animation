#sprite-animation
================

**Sprite animation lib for playing atlas animations **

The sprite animation lib uses canvas for displaying the sprite animation.


###Some important notes:

- Uses a SpriteCache class to store and share the loaded textures.
- Requires a JSON hash atlas format.
- Multipacking is supported
- Trim is supported
- Rotation is NOT supported (yet)

###Dependecies

Only has one dependency.

- jQuery


###The Atlas

As stated the this lib supports a JSON Hash format atlas with multipacking and trimming. Do **_NOT_** use rotation as it is not supported. 

###Events

The lib triggers the following events:

```
sprite-animation:ready 
```
_Atlas is loaded and SpriteAnimation is ready_

```
sprite-animation:animation-done 
```
_Animation is done playing, the animation name is passed as a argument._

```
sprite-animation:animation-loop
```
_Animation loop is started, the animation name is passed as a argument._


###Sample code

####Instantiation
```
var sprite = new SpriteAnimation(target, true);
```
_Create a new instance, first variable is the target, second a boolean if canvas should be auto appended._

__Parameters:__

- __target__: {element} The DOM element
- __autoAppend__: {boolean} Optional: Auto append the canvas to the DOM element

####Loading the Atlas
```
sprite.load(['animation.json'], ['animation-retina.json']);
```

_The load function takes at least one string or array with atlas urls. You can pass a second string or array for the retina version of your Atlas. The atlas and image are stored in a shared cache. There is no need to load the same atlas mutliple times over different instances._

__Paramenters:__

- __urls__: {string|array} A Atlas url or list of Atlas urls.
- __retinaUrls__: {string|array} Optional: A retina Atlas url or list of retina Atlas urls.


####Defining animations

```
sprite.addAnimation('icon-loop', 'icon-loop_%%.png', '%', 1, 30);

sprite.addAnimation('icon-intro', 'icon-intro_%%.png', '%', 1, 30);
```

_A single instance can contain multiple animations._

__Paramenters:__

- __animationName__: {string} A unique identifier of the animation
- __frameName__: {string} The name identifier as defined in the atlas. The % symbol in the example will be replaced by a frame number. The name in the atlas for example is: icon-loop_01.png
- __delimiter__: The delimiter symbol which will be replaced with a frame number. In the example I used %. 
- __startFrame__: For animations where the frameName does not start at frame 0 you can pass a offset. The example starts at icon-loop_01.png.
- __fps__: The animations frames per second.


####Playing a animation
```
sprite.playAnimation('icon-loop', true, 0, 10);
```
_Start playing the in a loop from frame 0 to 10, you can also use frameNames._

__Paramenters:__

- __animationName__: {string} A unique identifier of the animation.
- __loop__: {boolean} Optional: Loops the animation.
- __from__: {int|string} Optional: Start the animation at a specific frame number or name.
- __to__: {int|string} Optional: Stop the animation at a specific frame number or name.


####Stopping a animation
```
sprite.stop(false);
```
_Stops the animation._

__Paramenters:__

- __clear__: {boolean} If true is passed the canvas is cleared after stopping.


####Disposing
```
sprite.dispose();
```
_Disposes the SpriteAnimation instance, note that the cached atlases remain in cache._


####Flushing the cache
```
sprite.cache().flush(['animation.json', 'animation-retina.json']);
```
_sprite.cache() returns a instance of the SpriteCache. __NOTE:__ If no parameters are passed the entire cache is flushed._

__Paramenters:__

- __urls__: {string|array} Clear specific urls from the cache.


####Events

Listen to events using jQueries on, one and off methods.
