from Rhino.Geometry import Point3d, Vector3d, Curve
import random

#set seed for consistent randomness
random.seed(seed)
#for 2*PI convenience
tau = 6.28

#create boid class
class Boid():
	
	#define Boid parameters at creation
	def __init__(self, initialPosition, initialHeading):
		self.position = initialPosition
		self.heading = initialHeading
		self.inclusiveTrail = [initialPosition]
		self.exclusiveTrail = []
		
		### these are all random numbers for various behavioral parameters.
		### make as many as you want!
		self.sensitivity = random.uniform(0,viewDistance)
		self.inwards = random.uniform(0,1)
		self.confidence = random.uniform(0,1)
		self.generosity = random.uniform(0,1)
		self.flexibility = random.uniform(0,1)
		self.energy = random.uniform(.5,1)
		self.inclusion = random.uniform(0,1)


	#update Boid position every iteration and leave behind trail
	def move(self):
		#update position based on new heading
		### we now have a property in "energy" that determines how far the bird can travel (in behavioral space) each time step
		### we might understand this as 'enthusiasm', or 'behavioral engagement in workplace culture'
		self.position = Point3d.Add( self.position, self.heading * self.energy )
		
		### leave points behind for later analysis if the bird is feeling welcome or unwelcome
		if self.inclusion > .25:
			self.inclusiveTrail.append( self.position )
		else:
			self.exclusiveTrail.append(self.position)
	
	#make personal decision based on social logic
	def findDirection(self, allBoids):
		#slice list and remove self from social calculations
		others = allBoids[:]
		others.remove(self)
		
		#find other nearby Boids
		neighbors = []

		#evaluate all other birds
		for other in others:
			distance = self.position.DistanceTo( other.position )
			if distance < self.sensitivity:
				neighbors.append(other)
		
		#if we find neighbors...
		if len(neighbors) > 0:
			#store number of neighbors
			neighborCount = len(neighbors)

			### We have access to the number of nearby birds. Intraversion/Extraversion bonus and penalty might be this simple.
			#check if there are too many birds around for comfort
			if neighborCount > self.inwards * numBoids:
				self.energy -= .1
				self.inclusion -= .05


			### This is how you can compare each bird to the birds it acknowledges as within its awareness 
			### This will be how we can model social interactions and feelings of belongingness within groups large and small

			#check if the birds around this bird are similar to this bird, with tolerance
			likeMinds = 0
			for i in range(neighborCount):
				if (neighbors[i].inwards < self.inwards+self.flexibility) and (neighbors[i].inwards > self.inwards-self.flexibility):
					likeMinds += 1
				
			#likeminded collaboration bonus
			if likeMinds > 5:
				self.inclusion += .05
				self.energy += .05
			
			#check if this bird is intimidated by its neighbors
			intimidation = 0
			for i in range(neighborCount):
				if neighbors[i].confidence > self.confidence:
					intimidation += 1
			
			#determine what proportion of birds are intimidating
			intimidationPercentage = intimidation/neighborCount

			#penalty to multiple properties for intimidation
			if intimidationPercentage > .25 :
				self.confidence -= .1
				self.energy -= .1
				self.inclusion -=.05

			### each bird can also affect its neighbors' parameters
			if random.uniform(0,1) > self.generosity:
				for i in range(neighborCount):
					neighbors[i].energy += .1
					neighbors[i].generosity += .01
					neighbors[i].inclusion += .05

			###boost inclusive feeling like social contagion to nearby birds
			if self.inclusion > .8 :
				for i in range(neighborCount):
					neighbors[i].inclusion += .05

			### crisis!
			if self.energy < .1 :
				#run away if energy is super low
				self.dissociate()

			### make decisions based on our parameters
			### self.flee = run away from everyone
			### self.cohere = head towards a center of birds
			### self.align = line up with other birds
			### self.maintain = keep going in the same direction
			### self.dissociate = head in a random direction

			### all of these can be with *neighbors* or all *others*
			### self.flee(neighbors) - run away from nearby birds
			### self.flee(others) - run away from all other birds

			### run away if confidence is low
			if self.confidence < .25:
				self.flee(neighbors)
			### if the bird has middle confidence, align it with its neighbors, but don't seek the center of the flock
			elif self.confidence < .75:
				self.align(neighbors)
			### if the bird has strong confidence, align it with its neighbors, and seek the center of the flock				
			elif self.confidence < .9:
				self.align(neighbors)
				self.cohere(neighbors)
			### strong confidence, keep going!
			else:
				self.maintain()

			### redirect birds from the boundary box
			if (self.position[0] > bound) or (self.position[1] > bound) or (self.position[2] > bound):
				self.align(others)
				self.cohere(others)
			if (self.position[0] < 0) or (self.position[1] < 0) or (self.position[2] < 0):
				self.align(others)
				self.cohere(others)
		
		#fly back to the flock center if no neighbors found
		else:
			self.align(others)
			self.cohere(others)
				
	#align heading with other Boids 
	def align(self, others):
		#generate list of other Boid headings
		headings = [other.heading for other in others]
		#empty vector creation
		uberVector = Vector3d(0.0,0.0,0.0)
		#add up all headings
		for heading in headings:
			uberVector = Vector3d.Add( uberVector, heading )
		#remove magnitude from sum of all headings 
		uberVector = Vector3d.Divide( uberVector, uberVector.Length )
		#set Boids heading to aligned vector
		self.heading = uberVector 
	
	#seek center of Boids population
	def cohere(self, others):
		#find average point of all other Boids
		centerPoint = others.pop(0).position
		for other in others:
			centerPoint = Point3d.Add( centerPoint, other.position )
		centerPoint = Point3d.Divide( centerPoint, numBoids - 1 )
		#find direction from Boid to average point of all other Boids
		direction = Point3d.Subtract( centerPoint, self.position )
		#remove magnitude from average-seeking vector
		direction = Vector3d.Divide( direction, direction.Length )
		#adapt heading to new direction
		self.heading = Vector3d.Add( direction, self.heading )
	
	#run away from center of Boids population
	def flee(self, others):
		#find average point of all other Boids
		centerPoint = others.pop(0).position
		for other in others:
			centerPoint = Point3d.Add( centerPoint, other.position )
		centerPoint = Point3d.Divide( centerPoint, numBoids - 1 )
		#find direction from Boid to average point of all other Boids
		direction = Point3d.Subtract( centerPoint, self.position )
		#remove magnitude from average-seeking vector
		direction = Vector3d.Divide( direction, direction.Length )
		#adapt heading to new direction
		self.heading = Vector3d.Add( -direction, self.heading )
		self.heading = Vector3d.Add( -direction, self.heading )
		
	#be weird
	def dissociate(self):
		self.heading = Vector3d(random.uniform(-.5,.5),random.uniform(-.5,.5),random.uniform(-.5,.5))
	
	#steady course plus small random adjustments
	def maintain(self):
		newDirection = Vector3d(random.uniform(-.5,.5),random.uniform(-.5,.5),random.uniform(-.5,.5))
		self.heading = Vector3d.Add( newDirection, self.heading )
		
		
#create Boids
if numBoids:
	boids = []

	for n in range(numBoids):
		x = random.triangular( 0, bound )
		y = random.triangular( 0, bound )
		z = random.triangular( 0, bound )
		
		u = random.triangular( -tau, tau )
		v = random.triangular( -tau, tau )
		w = random.triangular( -tau, tau )

		
		boidPoint = Point3d( x, y, z )
		heading = Vector3d( u, v, w )
		
		boid = Boid( boidPoint, heading )
		boids.append( boid )
	
if run and numSteps:
	print('Flock success!')
	
	# iteration loop
	for i in range(numSteps):
	
		# evaluate boids
		for boid in boids:
			boid.findDirection( boids )
		
		# move boids
		for boid in boids:
			boid.move()

#output points
points = [boid.position for boid in boids]

inclusiveTraces = []
for boid in boids:
	inclusiveTraces.append(Curve.CreateControlPointCurve( boid.inclusiveTrail, 3))

exclusiveTraces = []
for boid in boids:
	exclusiveTraces.append(Curve.CreateControlPointCurve( boid.exclusiveTrail, 3))