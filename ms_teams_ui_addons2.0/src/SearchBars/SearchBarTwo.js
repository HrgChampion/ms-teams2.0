import "./SEarchBarTwo.css"
export default function SearchBarTwo(){
    let wait;
    function debounce(func,delay){
       
        
        if(wait){
            clearTimeout(wait);
        }

        wait=setTimeout(()=>{
            func()
        },delay)
    }
    async function searchVideo(){
        try{
            let video_query=document.getElementById("video").value;
            let response=await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&q=${video_query}&type=video&key=AIzaSyC1G_MC-DeBLd5rpMe2wpLqvIy5makFREM&maxResults=20&safeSearch=strict&q=${video_query}`);
            let data=await response.json();

            let videos=data.items;
            appendVideos(videos)
            
            console.log("data:",data)
        }catch(e){
            console.log("e:",e)
        }
    }
    const appendVideos=(items) =>{
    //    results_div.innerHTML=null;
        
        items.forEach(element => {
            let {snippet,
                id:{videoId},
            }=element;
            console.log("snippet:",snippet);
            let div=document.createElement("div");
          
            let title=document.createElement("p");
            title.innerText=snippet.title;
            let thumbnail=document.createElement("img");
            thumbnail.src=snippet.thumbnails.medium.url;

            let data_to_send={
                snippet,
                videoId
            }

            div.onclick=()=>{
                showVideo(data_to_send)
            }


            div.append(thumbnail,title)

        //    results_div.append(div);
        });
        localStorage.setItem("appendimages",JSON.stringify(items))
    }
    function showVideo(data){
        localStorage.setItem("clicked_video",JSON.stringify(data));
        window.location.href="video.html"
    }

    return(
        <div>
        <div className="searchBarTwo">
        <input oninput={debounce(searchVideo,1000)} type="text" id="video"/>
    <button onclick={searchVideo()}>Search</button>
        </div>
        </div>
    )
}