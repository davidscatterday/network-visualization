function Chart() {
	// Exposed variables
	let attrs = {
		id: 'ID' + Math.floor(Math.random() * 1000000), // Id for event handlings
		svgWidth: 400,
		svgHeight: 400,
		marginTop: 35,
		marginBottom: 5,
		marginRight: 5,
		marginLeft: 50,
		container: 'body',
		defaultTextFill: '#2C3E50',
		defaultFont: 'Lato',
		container: '#network-graph-container',
		nodeSize: { min: 2, max: 20 },
		domainObject: {},
		colorPalette: ['#2965CC', '#29A634', '#D99E0B', '#D13913', '#8F398F', '#00B3A4', '#DB2C6F', '#9BBF30', '#96622D', '#7157D9'],
		lineWidth: { primary: 1.5, secondary: 0.2 },
		clickedNode: null,
		hoveredNode: null,
		edges: { defaultStrokeColor: '#cccccc' },
		nodes: { defaultBorderColor: '#ffffff', highlightedBorderColor: '#000000', padding: 10 },
		legend: {
			legendContainerParentID: 'legends-container',
			fontFamily: 'Lato',
			textColor: 'currentColor',
			fontSize: '12px',
			textAnchor: 'end',
			legendsContainerPadding: { top: 2, left: 2 },
			width: 15,
			height: 15,
			rx: 8,
			textY: 8,
			textDy: '0.32em',
			count: 10,
			strokeWidth: 2,
			pointerEvents: 'none',
			columnHorizontalDistance: 160,
			eachRowDistance: 25,
			horizontalSpacing: 5,
			textPointerEvents: 'none'
		},
		rawData: null
	};

	//Main chart object
	let main = function () {
		//Drawing containers
		let container = d3.select(attrs.container);

		//Calculated properties
		let calc = {};
		calc.id = 'ID' + Math.floor(Math.random() * 1000000); // id for event handlings
		calc.chartLeftMargin = attrs.marginLeft;
		calc.chartTopMargin = attrs.marginTop;

		let graphData = generateGraphData(attrs.rawData);
		let canvas = container.select("canvas").node();

		// Set canvas width and height to match the container
		canvas.width = container.node().clientWidth;
		canvas.height = container.node().clientHeight;

		let context = canvas.getContext("2d"),
			width = canvas.width,
			height = canvas.height;

		let chosenNodeSizeOption = d3.select('#select-by-node-size').node().value;
		let nodeSizeDomainNumbers = getNodeSizeScaleDomain(graphData, chosenNodeSizeOption);

		let nodeRadiusScale = d3.scaleLinear()
			.domain(d3.extent(nodeSizeDomainNumbers))
			.range([attrs.nodeSize.min, attrs.nodeSize.max]);

		calc.uniqueCategories = Array.from(new Set(graphData.nodes.map(d => d['Social Determinant Category'])));

		calc.categoryPercentages = getCategoryPercentages(calc, graphData.nodes);
		calc.colorsObject = generateColorsObject(calc);

		calc.clusterCenters = calculateClusterCenters(canvas.width, canvas.height, calc.uniqueCategories);

		let transform = d3.zoomIdentity;

		// The simulation will alter the input data objects so make
		// copies to protect the originals.
		const edges = graphData.links.map(d => Object.assign({}, d));

		const nodes = graphData.nodes.map(function (d) {
			if (['Research Method Population Scale', 'Harm Magnitude', 'Harm Population Impact'].includes(chosenNodeSizeOption)) {
				d.nodeRadius = nodeRadiusScale(attrs.domainObject[d[chosenNodeSizeOption]]);
			}
			else {
				d.nodeRadius = nodeRadiusScale(+d[chosenNodeSizeOption]);
			}

			return Object.assign({}, d);
		});

		let zoom = d3.zoom()
			.scaleExtent([1 / 10, 8])
			.on('zoom', zoomed);

		d3.select(canvas)
			.call(zoom);

		let simulation = d3.forceSimulation()
			.force("center", d3.forceCenter(width / 2, height / 2))
			.force("charge", d3.forceManyBody()) // .strength(-40)
			.force("link", d3.forceLink().id(d => d.id))
			.on("tick", simulationUpdate);

		let defaultZoomVariables = calculateDefaultZoomVariables();

		// Apply the zoom programmatically with animation
		d3.select(canvas)
			.transition()
			.duration(2000) // Duration in milliseconds
			.call(
				zoom.transform,
				transform
					.translate(-width / defaultZoomVariables.sizeDivider, -height / defaultZoomVariables.sizeDivider)
					.scale(defaultZoomVariables.initialScale));

		simulation.nodes(nodes);

		simulation.force("link")
			.links(edges);

		addLegends(attrs, calc);

		eventListeners();

		// FUNCTIONS

		function calculateDefaultZoomVariables() {
			let initialScale = 2.8;
			let sizeDivider = 1.1;

			if (innerWidth < 1600) {
				initialScale = 2.3;
				sizeDivider = 1.5;
			}

			return { initialScale: initialScale, sizeDivider: sizeDivider };
		}

		function addLegends(attrs, calc) {
			const legendsContainerParent = d3.select(`#${attrs.legend.legendContainerParentID}`);

			const legendSvg = legendsContainerParent
				.select('svg');

			legendSvg.select('.legend-wrapper').remove();

			//legends wrapper
			let legendsWrapper = legendSvg
				.append('g')
				.classed('legend-wrapper', true)
				.attr('transform', `translate(${attrs.legend.legendsContainerPadding.left},${attrs.legend.legendsContainerPadding.top})`);

			let legends = calc.uniqueCategories
				.map(function (d) {
					return {
						categoryName: d,
						percentage: calc.categoryPercentages[d],
					};
				})
				.sort(function (a, b) { return b.percentage - a.percentage });

			legendSvg.attr('height', legends.length * attrs.legend.eachRowDistance);

			let columns = 1;

			//each legend wrapper group
			let legendGroups = legendsWrapper
				.selectAll('g')
				.data(legends)
				.enter()
				.append('g')
				.classed('highlight-legend-group', true)
				.attr('transform', function (_d, i) {
					let x = (i % columns) * attrs.legend.columnHorizontalDistance;
					let y = Math.floor(i / columns) * attrs.legend.eachRowDistance;

					return 'translate(' + x + ',' + y + ')';
				})
				.style('cursor', 'pointer');

			//legend circles
			legendGroups
				.append('rect')
				.attr('width', attrs.legend.width)
				.attr('height', attrs.legend.height)
				.attr('rx', attrs.legend.rx)
				.attr('fill', (d) => calc.colorsObject[d.categoryName])
				.attr('stroke-width', attrs.legend.strokeWidth)
				.attr('stroke', (d) => calc.colorsObject[d.categoryName]);

			//legend texts
			legendGroups
				.append('text')
				.text(d => d.categoryName || 'No Data')
				.attr('y', attrs.legend.textY)
				.attr('x', attrs.legend.width + attrs.legend.horizontalSpacing)
				.attr('dy', attrs.legend.textDy)
				.attr('font-family', attrs.legend.fontFamily)
				.attr('fill', attrs.legend.textColor)
				.attr('font-size', attrs.legend.fontSize)
				.attr('pointer-events', attrs.legend.textPointerEvents)
		};

		function getCategoryPercentages(calc, nodes) {
			let total = nodes.length;
			let categorySumObject = {};
			let categoryPercentages = {};

			nodes.forEach(function (nodeData) {
				if (categorySumObject[nodeData[['Social Determinant Category']]]) categorySumObject[nodeData[['Social Determinant Category']]] += 1;
				else categorySumObject[nodeData[['Social Determinant Category']]] = 1;
			});

			calc.uniqueCategories.forEach(function (categoryName) {
				let groupSum = categorySumObject[categoryName] || 0;
				let percent = (groupSum / total) * 100;

				categoryPercentages[categoryName] = percent;
			});

			return categoryPercentages;
		};

		function zoomed(e) {
			transform = e.transform;
			simulationUpdate(true);
		}

		function simulationUpdate(preventAutomaticGrouping) {
			context.save();
			context.clearRect(0, 0, width, height);
			context.translate(transform.x, transform.y);
			context.scale(transform.k, transform.k);

			// Get the current alpha value
			const currentAlpha = simulation.alpha();

			drawEdges(edges, currentAlpha, preventAutomaticGrouping);
			drawNodes(nodes, currentAlpha, preventAutomaticGrouping);

			context.restore();
		}

		function drawEdges(edges) {
			edges.forEach(function (d) {
				context.globalAlpha = 1;

				context.beginPath();
				context.moveTo(d.source.x, d.source.y);
				context.lineTo(d.target.x, d.target.y);
				context.lineWidth = d.primary ? attrs.lineWidth.primary : attrs.lineWidth.secondary;
				context.strokeStyle = edgeStrokeColor(d);

				if ((attrs.hoveredNode || attrs.clickedNode) && context.strokeStyle === attrs.edges.defaultStrokeColor)
					context.globalAlpha = 0.3;

				context.stroke();
			});
		}

		function drawNodes(nodes, currentAlpha, preventAutomaticGrouping) {
			nodes.forEach(function (d) {
				context.globalAlpha = 1;

				context.beginPath();

				let relevantCluster = calc.clusterCenters[d['Social Determinant Category']];

				if (!preventAutomaticGrouping) {
					d.x += (relevantCluster.x - d.x) * currentAlpha;
					d.y += (relevantCluster.y - d.y) * currentAlpha;
				}

				context.moveTo(d.x + d.nodeRadius, d.y);
				context.arc(d.x, d.y, d.nodeRadius, 0, 2 * Math.PI);

				context.strokeStyle = nodeBorderColor(d);
				context.lineWidth = 0.5;

				if ((attrs.hoveredNode || attrs.clickedNode) && context.strokeStyle === attrs.nodes.defaultBorderColor)
					context.globalAlpha = 0.3;

				context.stroke();

				d.nodeColor = calc.colorsObject[d['Social Determinant Category']];
				context.fillStyle = d.nodeColor;
				context.fill();
			});
		}

		function nodeBorderColor(nodeData) {
			if (attrs.hoveredNode?.ID === nodeData.ID || attrs.clickedNode?.ID === nodeData.ID)
				return attrs.nodes.highlightedBorderColor;

			return attrs.nodes.defaultBorderColor;
		}

		function edgeStrokeColor(edgeData) {
			let sourceAndTargetID = [edgeData.source.ID, edgeData.target.ID];

			if (sourceAndTargetID.includes(attrs.clickedNode?.ID))
				return attrs.clickedNode.nodeColor;

			if (sourceAndTargetID.includes(attrs.hoveredNode?.ID))
				return attrs.hoveredNode.nodeColor;

			return attrs.edges.defaultStrokeColor;
		}

		function eventListeners() {
			nodeSizeListener();
			secondaryLinksListener();

			// introduce small delay before attaching events to nodes
			setTimeout(() => {
				circleHoverListener(canvas, simulation);
				circleClickListener(canvas);
			}, 1000);
		}

		function calculateClusterCenters(canvasWidth, canvasHeight, categories) {
			const numClusters = categories.length;
			const centers = {};

			// The first cluster is in the center
			const centerCluster = { x: canvasWidth / 2, y: canvasHeight / 2 };
			centers[categories[0]] = centerCluster;

			if (numClusters === 1) {
				return centers; // If only one cluster, just return the center
			}

			// For the remaining clusters, arrange them in a hexagonal pattern around the center
			const radius = Math.min(canvasWidth, canvasHeight) / 8; // Adjust the radius for distribution
			const angleStep = (2 * Math.PI) / (numClusters - 1); // Distribute remaining clusters

			for (let i = 1; i < numClusters; i++) {
				const angle = (i - 1) * angleStep;
				const x = centerCluster.x + radius * Math.cos(angle);
				const y = centerCluster.y + radius * Math.sin(angle);
				centers[categories[i]] = { x: x, y: y };
			}

			return centers;
		}

		function circleHoverListener(canvas, simulation) {
			let hoverDatatableResearchContainer = d3.select('.research-metadata-container');
			let hoverDatatableRacialContainer = d3.select('.racial-harm-metadata-container');

			d3.select(canvas).on("mousemove", function (event) {
				simulation.stop();

				attrs.hoveredNode = null;

				const [mouseX, mouseY] = d3.pointer(event);
				const searchRadius = attrs.nodeSize.max; // Adjust this as needed

				let simulationX = transform.invertX(mouseX);
				let simulationY = transform.invertY(mouseY);

				// Find the closest node to the mouse position within the search radius
				attrs.hoveredNode = simulation.find(simulationX, simulationY, searchRadius);

				// Check if a node is found
				if (attrs.hoveredNode) {
					clearDatatables(hoverDatatableResearchContainer, hoverDatatableRacialContainer);

					showDatatableInfo(attrs.hoveredNode, hoverDatatableResearchContainer, hoverDatatableRacialContainer);

					document.body.style.cursor = 'pointer';
				}
				else if (attrs.clickedNode) {
					clearDatatables(hoverDatatableResearchContainer, hoverDatatableRacialContainer);
					showDatatableInfo(attrs.clickedNode, hoverDatatableResearchContainer, hoverDatatableRacialContainer);

					document.body.style.cursor = 'default';
				}
				else {
					clearDatatables(hoverDatatableResearchContainer, hoverDatatableRacialContainer);
					document.body.style.cursor = 'default';
				}

				simulationUpdate(true);
			});
		};

		function showDatatableInfo(currentNode, hoverDatatableResearchContainer, hoverDatatableRacialContainer) {
			let hoverDatatableResearchRow = hoverDatatableResearchContainer.select('.datatable-info-row');
			let hoverDatatableRacialRow = hoverDatatableRacialContainer.select('.datatable-info-row');

			let researchColumns = ["Title", "Year Published", "Primary Author", "Number of Works Cited", "Number of External Citations", "Author Total Works Published", "Research Location", "Research Type", "Research Method", "Research Method Population Size"];
			let racialColumns = ["Social Determinant Category", "Primary Determinant Analyzed", "Secondary Determinant Analyzed 1", "Secondary Determinant Analyzed 2", "Secondary Determinant Analyzed 3", "Aligned SDG", "Harm Magnitude", "Harm Population Impact"];

			researchColumns.forEach(function (researchColumnName) {
				let value = currentNode[columnNameMapper(researchColumnName)];
				hoverDatatableResearchRow.append('div').classed('datatable-info-col', true).html(datatableCellHtml(researchColumnName, value));
			});

			racialColumns.forEach(function (racialColumnName) {
				let value = currentNode[racialColumnName];
				hoverDatatableRacialRow.append('div').classed('datatable-info-col', true).html(datatableCellHtml(racialColumnName, value));
			});

			hoverDatatableResearchContainer.classed('hidden', false);
			hoverDatatableRacialContainer.classed('hidden', false);
		}

		function circleClickListener(canvas) {
			d3.select(canvas).on("click", function (_event) {
				if (attrs.clickedNode?.ID === attrs.hoveredNode?.ID)
					attrs.clickedNode = null;
				else
					attrs.clickedNode = attrs.hoveredNode;

				simulationUpdate(true);
			});
		};

		function columnNameMapper(columnName) {
			if (columnName === 'Number of Works Cited') return 'Cites';
			if (columnName === 'Number of External Citations') return 'Cited By';
			if (columnName === 'Author Total Works Published') return 'Author Total Works Count';
			if (columnName === 'Research Location') return 'Research Locations';
			if (columnName === 'Research Method Population Size') return 'Research Method Population Scale';

			return columnName;
		}

		function clearDatatables(hoverDatatableResearchContainer, hoverDatatableRacialContainer) {
			hoverDatatableResearchContainer.classed('hidden', true).selectAll('.datatable-info-col').remove();
			hoverDatatableRacialContainer.classed('hidden', true).selectAll('.datatable-info-col').remove();
		}

		function datatableCellHtml(key, value) {
			return `
                    <div class="widget-content">
                        <div class="widget-heading"> ${key} </div>
                        <div class="widget-subheading">${value || ''} </div>
                    </div>`
		}

		function generateColorsObject(calc) {
			let colorsObject = {};

			calc.uniqueCategories.forEach(function (category, index) {
				colorsObject[category] = attrs.colorPalette[index % attrs.colorPalette.length];
			});

			return colorsObject;
		}

		function nodeSizeListener() {
			d3.select('#select-by-node-size').on('change', function () {
				main();
			});
		}

		function secondaryLinksListener() {
			d3.select('#select-by-secondary-links').on('change', function () {
				main();
			});
		}

		function getNodeSizeScaleDomain(graphData, chosenNodeSizeOption) {
			let domain = [];
			let domainAttributesFromData;

			if (chosenNodeSizeOption === 'Research Method Population Scale') {
				domainAttributesFromData = ['Very Small', 'Small', 'Medium', 'Large', 'Very Large'];
				domain = mapAttributesToNumbers(domainAttributesFromData, false);

				domainAttributesFromData.forEach((key, i) => attrs.domainObject[key] = i);

			}
			else if (chosenNodeSizeOption === 'Harm Magnitude' || chosenNodeSizeOption === 'Harm Population Impact') {
				let correctOrder = ['Lower Harm', 'Medium Harm', 'High Harm'];
				let harmColumn = graphData.nodes.map(d => d[chosenNodeSizeOption]);
				domainAttributesFromData = customSortHarmNodes(harmColumn, correctOrder)

				domain = mapAttributesToNumbers(domainAttributesFromData, false);

				let uniqDomainAttributes = Array.from(new Set(domainAttributesFromData));
				uniqDomainAttributes.forEach((key, i) => attrs.domainObject[key] = i);
			}
			else {
				let stringAttributes = graphData.nodes
					.map(d => removeCommas(d[chosenNodeSizeOption]))

				stringAttributes.sort((a, b) => +a - +b);

				domain = mapAttributesToNumbers(stringAttributes, true);
			}

			return domain;
		}

		function removeCommas(num) {
			if (typeof num !== 'string')
				return num;

			return num.replace(/\,/g, '');
		};

		function mapAttributesToNumbers(attributes, numeralAttributes) {
			if (numeralAttributes) return attributes.map(num => +num);

			let uniqAttributes = Array.from(new Set(attributes));
			let domain = uniqAttributes.map((_d, i) => i);

			return domain;
		}

		function customSortHarmNodes(array, order) {
			return array.sort(function (a, b) {
				let harmLevelA = getFirstTwoWords(a);
				let harmLevelB = getFirstTwoWords(b);

				return order.indexOf(harmLevelA) - order.indexOf(harmLevelB);
			});
		}

		function getFirstTwoWords(str) {
			const words = str.split(' ');

			return words.slice(0, 2).join(' ');
		}

		function generateGraphData(rawData) {
			let nodes = rawData.filter(d => d.ID).map(d => d);

			let links = generateLinksData(nodes);

			return {
				nodes: nodes,
				links: links
			};
		}

		function generateLinksData(nodes) {
			let chosenSecondaryLinksOption = d3.select('#select-by-secondary-links').node().value;

			const groupByPrimaryDeterminantAnalyzed = d3.group(nodes.filter(d => d['Primary Determinant Analyzed']), d => d['Primary Determinant Analyzed']);
			const groupBySecondaryDeterminantAnalyzed = d3.group(nodes.filter(d => d[chosenSecondaryLinksOption]), d => d[chosenSecondaryLinksOption]);

			const groupedObjectPrimary = Object.fromEntries(groupByPrimaryDeterminantAnalyzed);
			const groupedObjectAnalyzed = Object.fromEntries(groupBySecondaryDeterminantAnalyzed);

			let linksTotal = [];

			nodes.forEach(function (nodeData) {
				let primaryLinksForGivenNode = [];
				let analyzedRelevantLinks = [];
				nodeData.id = nodeData.ID;

				if (nodeData['Primary Determinant Analyzed']) {
					primaryLinksForGivenNode = groupedObjectPrimary[nodeData['Primary Determinant Analyzed']]
						.map(function (d) {
							return { source: nodeData.ID, target: d.ID, primary: true }
						});
				}

				if (nodeData[chosenSecondaryLinksOption]) {
					analyzedRelevantLinks = groupedObjectAnalyzed[nodeData[chosenSecondaryLinksOption]]
						.map(function (d) {
							return { source: nodeData.ID, target: d.ID, primary: false }
						});
				}

				linksTotal.push(primaryLinksForGivenNode);
				linksTotal.push(analyzedRelevantLinks);
			});

			let flatLinks = linksTotal.flat();

			let cleanedLinks = cleanLinks(flatLinks);

			return cleanedLinks;
		}

		function cleanLinks(links) {
			const seen = new Set();

			return links.filter(link => {
				const sortedPair = [link.source, link.target].sort().join('-');

				if (link.source === link.target || seen.has(sortedPair)) {
					return false;
				}

				seen.add(sortedPair);

				return true;
			});
		}

		//#########################################  UTIL FUNCS ##################################

	};

	//Dynamic keys functions
	Object.keys(attrs).forEach((key) => {
		// Attach variables to main function
		return (main[key] = function (_) {
			let string = `attrs['${key}'] = _`;
			if (!arguments.length) {
				return eval(` attrs['${key}'];`);
			}
			eval(string);
			return main;
		});
	});

	// Run  visual
	main.render = function () {
		main();

		return main;
	};

	return main;
}
