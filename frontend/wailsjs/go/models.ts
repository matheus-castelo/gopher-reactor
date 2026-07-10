export namespace downloader {
	
	export class FormatOption {
	    format_id: string;
	    ext: string;
	    resolution: string;
	    note: string;
	    codec: string;
	    size: string;
	    tbr: number;
	    audio_only: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FormatOption(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.format_id = source["format_id"];
	        this.ext = source["ext"];
	        this.resolution = source["resolution"];
	        this.note = source["note"];
	        this.codec = source["codec"];
	        this.size = source["size"];
	        this.tbr = source["tbr"];
	        this.audio_only = source["audio_only"];
	    }
	}
	export class SubtitleOption {
	    code: string;
	    label: string;
	    auto: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SubtitleOption(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.code = source["code"];
	        this.label = source["label"];
	        this.auto = source["auto"];
	    }
	}

}

