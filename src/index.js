import {SpaceX} from "./api/spacex";
import * as d3 from "d3";
import * as Geo from './geo.json'

document.addEventListener("DOMContentLoaded", setup)

const PAD_RADIUS = 3;
const PAD_RADIUS_ACTIVE = 7;

function setup(){
    const spaceX = new SpaceX();
    const listContainer = document.getElementById("listContainer")
    const filter = document.getElementById("launchFilter")

    const load = () => {
        Promise.all([spaceX.launches(80, filter.value), spaceX.launchpads()])
            .then(([launches, launchpads]) => {
                drawMap(launchpadsToGeoJSON(mergePads(launchpads, launches)));
                renderLaunches(launches, listContainer);
            })
            .catch(error => {
                console.error(error);
                listContainer.textContent = `Не удалось загрузить данные из API :( ${error.message}`;
            });
    };

    // при переключении перезагружаем список и точки
    filter.addEventListener("change", load);
    load();
}

function mergePads(launchpads, launches){
    const byId = new Map(launchpads.map(pad => [pad.id, pad]));
    launches.forEach(launch => {
        if (launch.pad && !byId.has(launch.pad.id)) {
            byId.set(launch.pad.id, launch.pad);
        }
    });
    return Array.from(byId.values());
}

function launchpadsToGeoJSON(launchpads){
    return {
        type: "FeatureCollection",
        features: launchpads
            .filter(pad => pad.latitude != null && pad.longitude != null)
            .map(pad => ({
                type: "Feature",
                properties: {
                    id: pad.id,
                    name: pad.name,
                    location: pad.location ? pad.location.name : ""
                },
                geometry: {
                    type: "Point",
                    coordinates: [Number(pad.longitude), Number(pad.latitude)]
                }
            }))
    };
}

function renderLaunches(launches, container){
    const list = document.createElement("ul");
    launches.forEach(launch=>{
        const item = document.createElement("li");
        item.textContent = launch.name;
        // у каждого запуска есть вложенная площадка `pad` — при наведении подсвечиваем её точку
        const padId = launch.pad ? launch.pad.id : null;
        if (launch.pad) {
            item.title = `${launch.pad.name} — ${launch.pad.location ? launch.pad.location.name : ""}`;
        }
        item.addEventListener("mouseenter", () => {
            item.classList.add("active");
            highlightLaunchpad(padId);
        });
        item.addEventListener("mouseleave", () => {
            item.classList.remove("active");
            highlightLaunchpad(null);
        });
        list.appendChild(item);
    })
    container.replaceChildren(list);
}

function highlightLaunchpad(padId){
    d3.selectAll("circle.launchpad")
        .classed("active", d => padId != null && d.properties.id === padId)
        .attr("r", d => padId != null && d.properties.id === padId ? PAD_RADIUS_ACTIVE : PAD_RADIUS);
}

function drawMap(padsGeoJSON){
    // при переключении фильтра карту перерисовываем заново
    d3.select("#map").selectAll("svg").remove();
    const width = 640;
    const height = 480;
    const margin = {top: 20, right: 10, bottom: 40, left: 100};
    const svg = d3.select('#map').append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");
    const projection = d3.geoMercator()
        .scale(70)
        .center([0,20])
        .translate([width / 2 - margin.left, height / 2]);

    // страны мира
    svg.append("g")
        .selectAll("path")
        .data(Geo.features)
        .enter()
        .append("path")
        .attr("class", "topo")
        .attr("d", d3.geoPath()
            .projection(projection)
        )
        .attr("fill", function (d) {
            return colorScale(0);
        })
        .style("opacity", .7);

    // точки стартовых площадок
    const pads = svg.selectAll("circle.launchpad")
        .data(padsGeoJSON.features)
        .enter()
        .append("circle")
        .attr("class", "launchpad")
        .attr("cx", d => projection(d.geometry.coordinates)[0])
        .attr("cy", d => projection(d.geometry.coordinates)[1])
        .attr("r", PAD_RADIUS);

    // подсказка с названием площадки при наведении на точку
    pads.append("title")
        .text(d => d.properties.name + (d.properties.location ? ` — ${d.properties.location}` : ""));
}

const colorScale = d3.scaleOrdinal().range(["#a6bbce"]);
