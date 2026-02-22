export default async function handler(req, res) {

try {

if(req.method!=="POST")
return res.status(405).json({error:"POST only"});

const body = typeof req.body==="string"
? JSON.parse(req.body)
: req.body || {};

const prompt = body.prompt;

if(!prompt)
return res.status(400).json({error:"prompt missing"});

const r = await fetch(
"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key="+process.env.GEMINI_KEY,
{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({
contents:[{parts:[{text:prompt}]}]
})
}
);

const data = await r.json();
res.status(200).json(data);

}catch(e){

console.log(e);
res.status(500).json({error:String(e)});

}

}
