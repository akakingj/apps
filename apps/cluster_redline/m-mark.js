'use strict';
// Small, cached procedural mark: slanted tricolour blocks and a filled,
// bevelled silver M. Transparent outside its outline; no image/font asset.
const W = 88, H = 28, U = 128, V = 44;
const cache = Object.create(null);
const SHAPES = [
    [[0,43],[28,1],[48,1],[20,43]],
    [[20,43],[48,1],[68,1],[40,43]],
    [[40,43],[68,1],[88,1],[60,43]],
    [[60,43],[88,1],[106,1],[106,22],[118,1],[128,1],[128,43],
        [111,43],[111,25],[100,43],[83,43],[84,25],[74,43]],
];
const SILVER = [[0,[248,253,255]],[0.10,[228,238,244]],[0.35,[94,120,135]],
    [0.49,[46,69,82]],[0.66,[135,157,169]],[0.79,[241,247,250]],
    [0.92,[217,229,237]],[1,[106,130,145]]];
const STRIPES = [
    [[0,[92,190,248]],[0.25,[24,158,245]],[0.75,[0,142,242]],[1,[43,169,249]]],
    [[0,[15,113,186]],[0.28,[0,79,147]],[0.72,[0,42,91]],[1,[4,56,111]]],
    [[0,[255,47,77]],[0.30,[255,1,39]],[0.78,[235,0,23]],[1,[199,2,23]]],
];
function inside(poly, x, y) {
    let result = false;
    for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
        const a=poly[i],b=poly[j];
        if ((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) result=!result;
    }
    return result;
}
function edgeDistance(poly,x,y) {
    let best=Infinity;
    for(let i=0;i<poly.length;i++) {
        const a=poly[i],b=poly[(i+1)%poly.length],vx=b[0]-a[0],vy=b[1]-a[1];
        const f=Math.max(0,Math.min(1,((x-a[0])*vx+(y-a[1])*vy)/(vx*vx+vy*vy)));
        const dx=x-a[0]-vx*f,dy=y-a[1]-vy*f;best=Math.min(best,Math.sqrt(dx*dx+dy*dy));
    }
    return best;
}
function color(stops,f) {
    let i=0;while(i<stops.length-2&&f>stops[i+1][0])i++;
    const a=stops[i],b=stops[i+1],q=Math.max(0,Math.min(1,(f-a[0])/(b[0]-a[0])));
    return a[1].map((v,k)=>v+(b[1][k]-v)*q);
}
function raster(width,height) {
    width=Math.round(width===undefined?W:width);height=Math.round(height===undefined?H:height);
    if(!isFinite(width)||!isFinite(height)||width<1||height<1||width>512||height>512)throw new Error('Invalid mark size');
    const key=width+'x'+height;if(cache[key])return cache[key];
    const d=new Uint8Array(width*height*4),ss=4;
    for(let py=0;py<height;py++)for(let px=0;px<width;px++) {
        let n=0,r=0,g=0,b=0;
        for(let sy=0;sy<ss;sy++)for(let sx=0;sx<ss;sx++) {
            const x=(px+(sx+0.5)/ss)*U/width,y=(py+(sy+0.5)/ss)*V/height;
            let shape=-1;for(let k=0;k<SHAPES.length;k++)if(inside(SHAPES[k],x,y)){shape=k;break;}
            if(shape<0)continue;
            const c=color(shape===3?SILVER:STRIPES[shape],y/V),edge=edgeDistance(SHAPES[shape],x,y);
            // A narrow bright bevel follows the M's actual filled contour,
            // not a thin outline in place of the letter body.
            const bevel=shape===3?Math.max(0,1-edge/0.85):0;
            const shade=shape===3?1:0.82+0.18*Math.min(1,edge/0.7);
            r+=c[0]*shade+(223-c[0])*bevel*0.7;
            g+=c[1]*shade+(236-c[1])*bevel*0.7;
            b+=c[2]*shade+(244-c[2])*bevel*0.7;n++;
        }
        if(!n)continue;
        const p=(py*width+px)*4;d[p]=Math.round(r/n);d[p+1]=Math.round(g/n);d[p+2]=Math.round(b/n);d[p+3]=Math.round(n*255/(ss*ss));
    }
    return cache[key]={w:width,h:height,d:d};
}
function drawMark(cv,cx,y,width,height) {
    const image=raster(width,height);cv.blit(image,Math.round(cx-image.w/2),Math.round(y));return cv;
}
module.exports={drawMark:drawMark,raster:raster,W:W,H:H};
