import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const Graph = ({ data }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    const width = 800;
    const height = 600;

    // Clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    // Create SVG element
    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("border", "1px solid black");

    // Create a simulation for force-directed graph
    const simulation = d3
      .forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.links).id((d) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    // Create links (edges)
    const link = svg
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke-width", (d) => Math.sqrt(d.value));

    // Create nodes
    const node = svg
      .append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(data.nodes)
      .join("circle")
      .attr("r", 8)
      .attr("fill", (d) => d.color || "steelblue")
      .call(drag(simulation));

    // Node labels
    const label = svg
      .append("g")
      .selectAll("text")
      .data(data.nodes)
      .join("text")
      .attr("text-anchor", "middle")
      .attr("dy", -10)
      .text((d) => d.id)
      .style("font-size", "12px")
      .style("fill", "black");

    // Update simulation
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      label.attr("x", (d) => d.x).attr("y", (d) => d.y);
    });

    // Drag functionality
    function drag(simulation) {
      function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }

      return d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
  }, [data]);

  return <svg ref={svgRef} width="800" height="600"></svg>;
};

export default Graph;
